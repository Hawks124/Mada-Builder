-- ============================================================================
-- Setup post-migration : trigger signup, RLS users, bucket avatars.
-- Idempotent (relançable sans risque). Exécution : npm run db:setup
-- (tsx scripts/db-setup.ts, DATABASE_URL pooler recommandée).
-- ============================================================================

-- ── 1. Trigger : auth.users → public.users ──────────────────────────────────
-- Crée la ligne profil à l'inscription : username slug immuable
-- (display name ou préfixe email + suffixe si collision), rôle user,
-- providers initiaux déduits du provider d'inscription.
-- unaccent requis : lower() seul MANGE les accents ("Héry" → "hry").
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  suffix int := 0;
  -- Email effectif (placeholder si absent) — calculé UNE fois, réutilisé
  -- pour le slug ET la ligne (jamais de NULL qui fuite, voir ci-dessous).
  effective_email text;
BEGIN
  effective_email := coalesce(
    nullif(NEW.email, ''),
    'missing-' || substring(NEW.id::text from 1 for 8) || '@placeholder.local'
  );
  base_slug := coalesce(
    nullif(regexp_replace(unaccent(lower(NEW.raw_user_meta_data->>'display_name')), '[^a-z0-9]+', '-', 'g'), ''),
    nullif(split_part(effective_email, '@', 1), '')
  );
  base_slug := trim(both '-' from substring(base_slug from 1 for 20));
  IF base_slug IS NULL OR base_slug = '' THEN base_slug := 'maker'; END IF;

  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_slug) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  END LOOP;

  -- Email OAuth absent (GitHub sans email) : placeholder détectable
  -- (domaine invalide, jamais un vrai email) au lieu d'un crash NOT NULL.
  -- La gate /bienvenue exige un vrai email ensuite (marqueur commun
  -- service : voir isPlaceholderEmail, docs/auth.md §12).
  -- Doublon email inter-provider non fusionné (unverified) : échec PROPRE
  -- et loggé au lieu d'un 500 brut — l'utilisateur est guidé vers
  -- /bienvenue ("email déjà utilisé", docs/auth.md §12).
  BEGIN
    INSERT INTO public.users (id, username, display_name, email, avatar_url, providers)
    VALUES (
      NEW.id,
      final_slug,
    coalesce(
      nullif(NEW.raw_user_meta_data->>'display_name', ''),
      nullif(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(effective_email, '@', 1), ''),
      final_slug
    ),
    effective_email,
      -- GitHub = avatar_url, Google = picture : les deux clés couvertes.
      coalesce(
        nullif(NEW.raw_user_meta_data->>'avatar_url', ''),
        nullif(NEW.raw_user_meta_data->>'picture', '')
      ),
      ARRAY[coalesce(NEW.raw_app_meta_data->>'provider', 'email')]
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'handle_new_user: email % déjà pris (fusion inter-provider non vérifiée ?)', NEW.email
        USING ERRCODE = 'unique_violation';
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. RLS users ────────────────────────────────────────────────────────────
-- Lecture publique via allowlist de colonnes CÔTÉ SERVICE (RLS ne filtre
-- que les lignes, jamais les colonnes — l'email ne sort que par service_role
-- ou own-row). Ici : lecture authentifiée de base + écriture own-row only.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Lecture own-row UNIQUEMENT : un JWT authentifié ne voit que sa ligne.
-- Les lectures publiques (makers, leaderboard) passent par Drizzle côté
-- serveur (allowlist de colonnes, jamais l'email) — jamais par PostgREST.
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Verrou ban (défense en profondeur — l'enforcement réel vit dans
-- les services : assertNotBanned, jamais de confiance au seul RLS) :
-- Un banni garde la lecture own-row (motif affiché) mais perd TOUTES les
-- écritures directes ci-dessous (sous-requête banned_at). Seules exceptions :
-- suppression de compte et dépôt d'appel, via service_role (jamais PostgREST).
DROP POLICY IF EXISTS "users_update_own" ON public.users;
-- Verrou ban (§3d) : un banni garde la lecture own-row (bandeau motif)
-- mais perd TOUTES les écritures directes. Seules exceptions : suppression
-- de compte et dépôt d'appel, qui passent par service_role (jamais PostgREST).
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  )
  WITH CHECK (
    auth.uid() = id
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  );

-- Pas de INSERT/DELETE côté client : création par trigger, suppression par
-- service_role (cascade applicative documentée). Aucune policy = refusé.

-- ── 3. RLS auth_otp (codes OTP custom) ──────────────────────────────────────
-- Secrets éphémères : AUCUNE policy = refusé pour anon/authenticated via
-- le Data API (badge UNRESTRICTED éteint). service_role et postgres
-- bypassent RLS : Drizzle serveur (DATABASE_URL pooler postgres) et
-- l'admin Supabase continuent de fonctionner. Vérif rôle :
--   SELECT current_user;  -- attendu : postgres...
ALTER TABLE public.auth_otp ENABLE ROW LEVEL SECURITY;

-- ── 3b. RLS page_views (compteur vitrine) ───────────────────────────────────
-- AUCUNE policy = refusé pour anon/authenticated via le Data API.
-- Écritures service seules (DATABASE_URL postgres, bypass RLS), lectures
-- Drizzle serveur (overview admin). Invités inclus : user_id nullable.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- ── 3c. RLS appeals (contestations) ──────────────────────────────────────────
-- Écritures service seules (dépôt victime, décision). LECTURE staff via
-- policy ci-dessous (realtime admin : le socket postgres_changes respecte
-- le RLS — sans policy, zéro event reçu). Les chemins de pièces seuls ne
-- donnent rien (bucket sans policy lecture, URLs signées côté service).
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appeals_select_staff" ON public.appeals;
CREATE POLICY "appeals_select_staff"
  ON public.appeals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderateur')
    )
  );

-- ── 3d. RLS admin_actions (audit trail) ──────────────────────────────────────
-- AUCUNE policy = refusé via Data API (historique sensible : qui a sanctionné
-- qui). Écritures service seules (fail-soft : jamais bloquantes), lectures
-- Drizzle serveur (file admin). Pas de rétroactif : commence à la mise en prod.
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- ── 3d-bis. RLS email_logs (journal d'envois) ─────────────────────────────
-- AUCUNE policy = refusé via Data API (même hachés, les destinataires ne
-- s'exposent pas). Écritures service seules, lectures Drizzle serveur.
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ── 3d-ter. RLS avis/commentaires ─────────────────────────────────────────
-- AUCUNE écriture directe (unicité, compteurs et modération vivent dans
-- les services). LECTURE publique restreinte (mobile direct, hybride) :
-- éléments non supprimés de fiches publiées uniquement. Jamais les
-- auteurs bannis... (le contenu reste, l'auteur est masqué côté UI).
-- Lectures Drizzle serveur (fiches publiques, dashboard, admin).
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_select_published" ON public.reviews;
CREATE POLICY "reviews_select_published"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_id AND status = 'published' AND deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "comments_select_published" ON public.comments;
CREATE POLICY "comments_select_published"
  ON public.comments FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_id AND status = 'published' AND deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "comment_votes_select_own" ON public.comment_votes;
CREATE POLICY "comment_votes_select_own"
  ON public.comment_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 3d-quater. RLS + Realtime notifications ───────────────────────────────
-- Select own-row uniquement (authenticated, user_id = auth.uid()) : le
-- Realtime ne délivre que SES lignes, comme en REST. Écritures service
-- seules (fail-soft : une notif ne bloque jamais l'action métier).
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 3e. Realtime users (ban/déban sans refresh) ─────────────────────────────
-- Le watcher client (`use-ban-watcher`) écoute sa propre ligne : ban →
-- toast + refresh auto (écran verrouillé), déban → retour dashboard.
-- RLS existante (`users_select_own`) couvre la lecture temps réel :
-- authenticated ne voit que sa ligne, comme en REST. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appeals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appeals;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;-- Un banni garde la lecture own-row (bandeau motif) mais perd TOUTES les
-- écritures directes. Seules exceptions : suppression de compte et dépôt
-- d'appel, qui passent par service_role (jamais PostgREST).
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  )
  WITH CHECK (
    auth.uid() = id
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  );

-- ── 4. Bucket avatars + policies ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket pré-existant en privé (créé à la main avant ce setup) : forcer
-- public, sinon les public URLs rendent 403 (avatars cassés partout).
-- Idempotent : no-op si déjà public.
UPDATE storage.buckets SET public = true
WHERE id = 'avatars' AND public IS DISTINCT FROM true;

-- Lecture publique (avatars affichés partout, y compris déconnecté).
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Écriture own-path uniquement : avatars/{uid}/... (non-bannis seuls —
-- un banni ne change plus d'avatar ; voir §3d).
DROP POLICY IF EXISTS "avatars_write_own" ON storage.objects;
CREATE POLICY "avatars_write_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT banned_at FROM public.users WHERE id = auth.uid()) IS NULL
  );

-- ── 5. Bucket appeals (preuves, PRIVÉ) + policies ────────────────────────────
-- Pièces sensibles : jamais publiques. Insert own-path (bannis INCLUS —
-- c'est leur seule écriture avec la suppression de compte), lecture
-- service_role seule (URLs signées 72 h à la volée côté admin).
INSERT INTO storage.buckets (id, name, public)
VALUES ('appeals', 'appeals', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "appeals_write_own" ON storage.objects;
CREATE POLICY "appeals_write_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'appeals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Pas de SELECT/UPDATE/DELETE côté client sur ce bucket : aucune policy
-- = refusé. L'admin lit via service_role (signées), jamais PostgREST.

-- ── 6. RLS products (annuaire) ─────────────────────────────────────────────
-- Lecture publique = published non supprimés (SEO + annuaire, y compris
-- déconnecté). Auteur voit ses brouillons/pending/rejetés (own-row).
-- Staff voit tout (file de revue). ÉCRITURES service seules (deny-all
-- via Data API) : submit/édits/votes passent par Drizzle serveur
-- (assertNotBanned + ownership + validation Zod — jamais PostgREST).
-- Screenshots/votes/vues : AUCUNE policy (jamais exposés en brut :
-- galerie via service, compteurs dénormalisés sur products, vues
-- agrégées côté service). RLS ne filtre que les lignes, jamais les
-- colonnes : l'allowlist vit dans les services.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_screenshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screenshots_select_published" ON public.product_screenshots;
CREATE POLICY "screenshots_select_published"
  ON public.product_screenshots FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_id AND status = 'published' AND deleted_at IS NULL
    )
  );
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;ALTER TABLE public.product_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- featured_products : AUCUNE policy = refusé via Data API (le produit
-- du jour ne se fixe que côté service/admin — jamais PostgREST, sinon
-- n'importe qui épinglerait sa fiche). Lectures Drizzle serveur.
ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own"
  ON public.products FOR SELECT
  TO authenticated
  USING (maker_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "products_select_staff" ON public.products;
CREATE POLICY "products_select_staff"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderateur')
    )
  );

-- Pas de realtime products en V1 : leaderboard servi depuis le cache +
-- refresh navigation (vote optimiste côté client). Zéro socket à maintenir
-- pour un gain nul à ce volume (décision, pas oubli).

-- ── §7 Jobs (score 15 min, featured quotidien, purge mensuelle) ─────────
-- Fonctions SQL = chemins cron (pg_cron ne sait appeler que du SQL). Les
-- services TS restent la source pour les chemins applicatifs (vote →
-- rescore immédiat, lectures paresseuses, `scripts/run-jobs.ts`) : même
-- formule `w/(h+2)^1.5`, mêmes paliers featured, commentés des deux côtés.
-- Planification GARDÉE : pg_cron absent en local/dev → setup reste vert,
-- jobs actifs en prod (Supabase). R2 n'est pas atteignable en SQL : la
-- purge SQL nettoie la DB, `sweepR2Orphans` (TS) les objets.
CREATE OR REPLACE FUNCTION public.recompute_product_scores() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  n integer := 0;
  m integer := 0;
BEGIN
  -- Promotion anti-faille shadow-weighting (miroir du sweep TS) : un vote
  -- posé par un compte de < 24 h naît à weight = 0 — SANS ceci il resterait
  -- à 0 pour toujours. Promu AVANT le rescore du même passage.
  UPDATE public.votes v SET weight = 1
  WHERE v.weight = 0
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v.user_id
        AND u.created_at < now() - INTERVAL '24 hours'
        AND u.deleted_at IS NULL
        AND u.banned_at IS NULL
    );
  WITH sub AS (
    SELECT product_id, COUNT(*)::int AS total, COALESCE(SUM(weight), 0)::int AS weighted
    FROM public.votes GROUP BY product_id
  )
  UPDATE public.products p SET
    upvote_count = sub.total,
    score = sub.weighted / POWER(GREATEST(EXTRACT(EPOCH FROM (now() - p.published_at)) / 3600, 0) + 2, 1.5),
    updated_at = now()
  FROM sub
  WHERE p.id = sub.product_id AND p.status = 'published' AND p.deleted_at IS NULL
    AND p.published_at > now() - INTERVAL '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.products p SET upvote_count = 0, score = 0, updated_at = now()
  WHERE p.status = 'published' AND p.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.votes v WHERE v.product_id = p.id)
    AND (p.upvote_count <> 0 OR p.score <> 0);
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;

CREATE OR REPLACE FUNCTION public.rotate_featured_daily() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  today date := (now() AT TIME ZONE 'UTC')::date;
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
  chosen uuid;
  total integer;
BEGIN
  -- Déjà calculé (idempotent, pin respecté) : rien à faire.
  SELECT product_id INTO chosen FROM public.featured_products WHERE featured_on = today;
  IF FOUND THEN RETURN chosen; END IF;
  SELECT COUNT(*)::int INTO total FROM public.products WHERE status = 'published' AND deleted_at IS NULL;
  IF total = 0 THEN RETURN NULL; END IF;
  IF total = 1 THEN
    SELECT id INTO chosen FROM public.products
    WHERE status = 'published' AND deleted_at IS NULL ORDER BY published_at DESC LIMIT 1;
  ELSIF total < 5 THEN
    -- Rotation : jamais-featuré d'abord, re-feature >= 7 j.
    SELECT p.id INTO chosen FROM public.products p
    LEFT JOIN public.featured_products f ON f.product_id = p.id
    WHERE p.status = 'published' AND p.deleted_at IS NULL
      AND (f.featured_on IS NULL OR f.featured_on < CURRENT_DATE - 7)
    GROUP BY p.id
    ORDER BY MAX(f.featured_on) ASC NULLS FIRST, MAX(p.published_at) DESC LIMIT 1;
  ELSE
    -- Normal : #1 d'hier (votes pondérés) non-featuré depuis 30 j.
    SELECT p.id INTO chosen FROM public.products p
    WHERE p.status = 'published' AND p.deleted_at IS NULL
      AND p.published_at >= day_start - INTERVAL '1 day'
      AND p.published_at < day_start
      AND NOT EXISTS (
        SELECT 1 FROM public.featured_products f
        WHERE f.product_id = p.id AND f.featured_on >= CURRENT_DATE - 30
      )
    ORDER BY (SELECT COALESCE(SUM(v.weight), 0) FROM public.votes v WHERE v.product_id = p.id) DESC,
      p.published_at ASC
    LIMIT 1;
    -- Hier sans publication (week-end) : repli rotation.
    IF NOT FOUND THEN
      SELECT p.id INTO chosen FROM public.products p
      LEFT JOIN public.featured_products f ON f.product_id = p.id
      WHERE p.status = 'published' AND p.deleted_at IS NULL
        AND (f.featured_on IS NULL OR f.featured_on < CURRENT_DATE - 7)
      GROUP BY p.id
      ORDER BY MAX(f.featured_on) ASC NULLS FIRST, MAX(p.published_at) DESC LIMIT 1;
    END IF;
  END IF;
  IF chosen IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.featured_products (id, product_id, featured_on, pinned)
  VALUES (gen_random_uuid(), chosen, today, false)
  ON CONFLICT (featured_on) DO NOTHING;
  RETURN chosen;
END $$;

CREATE OR REPLACE FUNCTION public.purge_stale_drafts() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  n integer := 0;
BEGIN
  DELETE FROM public.products
  WHERE status = 'draft' AND updated_at < now() - INTERVAL '90 days' AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgcrypto indisponible : rotate_featured_daily échouera (gen_random_uuid)';
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponible : jobs non planifiés (relais scripts/run-jobs.ts)';
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- unschedule jette sur job absent : existence vérifiée d'abord.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'product-scores-15min') THEN
      PERFORM cron.unschedule('product-scores-15min');
    END IF;
    PERFORM cron.schedule('product-scores-15min', '*/15 * * * *', 'SELECT public.recompute_product_scores()');
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'featured-daily') THEN
      PERFORM cron.unschedule('featured-daily');
    END IF;
    PERFORM cron.schedule('featured-daily', '5 0 * * *', 'SELECT public.rotate_featured_daily()');
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drafts-purge-monthly') THEN
      PERFORM cron.unschedule('drafts-purge-monthly');
    END IF;
    PERFORM cron.schedule('drafts-purge-monthly', '30 3 1 * *', 'SELECT public.purge_stale_drafts()');
  END IF;
END $$;
