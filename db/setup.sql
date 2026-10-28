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
-- LECTURE publique restreinte (mobile direct, hybride) : éléments non
-- supprimés de fiches publiées uniquement. Jamais les auteurs bannis...
-- (le contenu reste, l'auteur est masqué côté UI). Lectures Drizzle
-- serveur (fiches publiques, dashboard, admin).
-- ÉCRITURE directe : ouverte par le pont 0055 (policies/grants/triggers
-- ci-dessous, §3d-quinquies) — identités only au RLS, business dans la
-- garde. DELETE jamais accordé (soft delete via deleted_at).
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
-- Grants (0055) : SELECT own-row only. Le REVOKE ferme le « ALL » par
-- défaut du Data API — l'écriture ne passe plus QUE par les triggers du
-- pont (SECURITY DEFINER, §3d-quinquies), jamais par un client.
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.notifications FROM authenticated;
GRANT SELECT ON public.notifications TO authenticated;

-- ── 3d-quinquies. Pont d'écriture directe avis/commentaires (migration
--    0055 — la migration fait foi ; ce bloc n'existe que pour reconstruire
--    un environnement neuf) ──────────────────────────────────────────────
-- La BASE devient le point d'application des règles : le mobile écrit en
-- direct PostgREST (avis, commentaires, votes), le web continue par le
-- service TS ; QUEL que soit l'écrivain, compteurs, score et notifications
-- sont posés par les triggers SECURITY DEFINER ci-dessous (le service TS
-- n'écrit plus jamais ces effets — aucun double-compte).
--   - Policies identités only (user_id = auth.uid()) ; le business (fiche
--     publiée, parent un niveau, ban, âge < 1 h, flood 20/60 s) vit dans
--     bridge_writer_guard.
--   - Grants PAR COLONNE : le client ne touche ni created_at, ni
--     maker_response, ni le user_id d'autrui. Lecture publique (anon)
--     inchangée sur avis/commentaires. Les CHECK (note 1–5, corps
--     d'avis 10–2000, commentaire 1–1000) sont posés par la migration,
--     pas ici (contraintes de structure = migrations).
--   - EXECUTE des fonctions revoké à PUBLIC : appelables par triggers
--     seuls (verify-security reste vert).

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comment_votes_insert_own" ON public.comment_votes;
CREATE POLICY "comment_votes_insert_own"
  ON public.comment_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comment_votes_update_own" ON public.comment_votes;
CREATE POLICY "comment_votes_update_own"
  ON public.comment_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comment_votes_delete_own" ON public.comment_votes;
CREATE POLICY "comment_votes_delete_own"
  ON public.comment_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT own-row (l'auteur voit ses propres lignes, même soft-supprimées,
-- même sur une fiche qui n'est plus publiée). REQUIS pour la reprise et
-- pour que le soft-delete passe : PostgreSQL applique AUSSI les policies
-- SELECT comme WITH CHECK sur la NOUVELLE ligne d'un UPDATE — la seule
-- policy SELECT publique (deleted_at IS NULL + fiche publiée) rendrait
-- donc tout UPDATE touchant deleted_at impossible pour l'auteur (la
-- nouvelle ligne deviendrait invisible-publique → refus 42501). Avec la
-- policy own-row, la nouvelle ligne reste visible à son auteur.
DROP POLICY IF EXISTS "reviews_select_own" ON public.reviews;
CREATE POLICY "reviews_select_own"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "comments_select_own" ON public.comments;
CREATE POLICY "comments_select_own"
  ON public.comments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Grants par colonne (la surface exacte du contrat mobile).
REVOKE ALL ON public.reviews FROM anon;
REVOKE ALL ON public.reviews FROM authenticated;
-- Lecture publique INCHANGÉE (fiches mobile déconnectées incl.).
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (id, user_id, product_id, rating, body) ON public.reviews TO authenticated;
GRANT UPDATE (rating, body, deleted_at, updated_at) ON public.reviews TO authenticated;
REVOKE ALL ON public.comments FROM anon;
REVOKE ALL ON public.comments FROM authenticated;
-- Lecture publique inchangée (voir reviews).
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT (id, user_id, product_id, parent_id, body) ON public.comments TO authenticated;
GRANT UPDATE (body, deleted_at, updated_at) ON public.comments TO authenticated;
REVOKE ALL ON public.comment_votes FROM anon;
REVOKE ALL ON public.comment_votes FROM authenticated;
GRANT SELECT ON public.comment_votes TO authenticated;
GRANT INSERT (id, user_id, comment_id, value) ON public.comment_votes TO authenticated;
GRANT UPDATE (value) ON public.comment_votes TO authenticated;
GRANT DELETE ON public.comment_votes TO authenticated;

-- Produits : JAMAIS dans la surface mobile du pont (écritures par le
-- service web seulement). Les grants par défaut Supabase (ALL) laissaient
-- INSERT/UPDATE/DELETE/TRUNCATE accordés à anon/authenticated — contenus
-- par le RLS mais silencieux (UPDATE → 0 ligne, sans erreur). Fermeture
-- nette : lecture publique inchangée, écriture refusée à l'API.
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.products FROM authenticated;
GRANT SELECT ON public.products TO anon, authenticated;

-- UUIDv7 côté base (curseur (created_at, id) : ordre temporel requis ;
-- la table notifications n'a pas de défaut sur id).
CREATE OR REPLACE FUNCTION public.bridge_uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE
SET search_path = ''
AS $$
DECLARE
  ms bigint;
  -- uuid_send : uuid → bytea (le cast direct uuid::bytea n'existe pas).
  rnd bytea := uuid_send(gen_random_uuid());
  b7 int; b9 int;
  v_hex text;
BEGIN
  ms := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  b7 := (7 << 4) | (get_byte(rnd, 8) & 15);          -- version 7 + 4 bits aléatoires
  b9 := (get_byte(rnd, 10) & 63) | 128;              -- variant 10xxxxxx
  v_hex :=
    substring(lpad(to_hex(ms), 16, '0'), 5, 12)       -- 6 octets de temps (48 bits)
    || lpad(to_hex(b7), 2, '0')
    || lpad(to_hex(get_byte(rnd, 9)), 2, '0')        -- 12 bits rand haut
    || lpad(to_hex(b9), 2, '0')                      -- variant + bits rand
    || lpad(to_hex(get_byte(rnd, 11)), 2, '0')       -- 7 octets restants : rnd(12..15) + rnd(1..2)
    || lpad(to_hex(get_byte(rnd, 12)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 13)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 14)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 15)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 1)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 2)), 2, '0');
  RETURN substring(v_hex, 1, 8) || '-'                  -- texte canonique 8-4-4-4-12
       || substring(v_hex, 9, 4) || '-'
       || substring(v_hex, 13, 4) || '-'
       || substring(v_hex, 17, 4) || '-'
       || substring(v_hex, 21, 12);
END;
$$;

COMMENT ON FUNCTION public.bridge_uuidv7() IS
  'UUIDv7 (48 bits de temps, triable) pour les écritures posées par les triggers du pont 0055.';

-- Garde écrivain (sessions JWT uniquement — auth.uid() présent) : compte
-- existant/banni/supprimé, âge < 1 h refusé, flood 20/60 s (filet global,
-- toutes ops de la table confondues ; le per-op contractuel reste côté
-- web/Upstash), produit publié, avis sur produit curaté refusé, parent
-- même produit + non supprimé + un seul niveau de réponse.
CREATE OR REPLACE FUNCTION public.bridge_writer_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_banned timestamptz;
  v_deleted timestamptz;
  v_created timestamptz;
  v_flood int;
BEGIN
  -- Gare de rôle : sessions service (auth.uid() NULL) passent. Le web
  -- possède déjà ses propres gardes TS (badge, âge, statut) ; une garde
  -- SQL sur la base n'est ni nécessaire ni utile.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT u.banned_at, u.deleted_at, u.created_at
    INTO v_banned, v_deleted, v_created
  FROM public.users u
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable.'
      USING DETAIL = 'reason=account_not_found';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Compte supprimé.'
      USING DETAIL = 'reason=account_deleted';
  END IF;
  IF v_banned IS NOT NULL THEN
    RAISE EXCEPTION 'Compte suspendu.'
      USING DETAIL = 'reason=account_banned';
  END IF;
  IF now() - v_created < interval '1 hour' THEN
    RAISE EXCEPTION 'Compte trop récent (réessayez dans une heure).'
      USING DETAIL = 'reason=account_too_young';
  END IF;

  -- Flood 20/60 s (miroir approximatif d'Upstash `feedback:*`) : filet
  -- global côté base, toutes écritures de la table confondues — la
  -- fenêtre contractuelle PAR OP reste côté web (Upstash). Ici on arrête
  -- seulement le déluge direct (hors API).
  EXECUTE format(
    'SELECT count(*) FROM %I.%I WHERE user_id = $1 AND created_at > now() - interval ''60 seconds''',
    TG_TABLE_SCHEMA, TG_TABLE_NAME)
  INTO v_flood USING COALESCE(NEW.user_id, OLD.user_id);
  IF v_flood >= 20 THEN
    RAISE EXCEPTION 'Trop de requêtes (réessayez dans une minute).'
      USING DETAIL = 'reason=flood';
  END IF;

  -- Avis : produit publié, non curaté (commentaires autorisés, eux).
  IF TG_TABLE_NAME = 'reviews' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Produit introuvable ou non publié.'
        USING DETAIL = 'reason=product_not_published';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id AND p.curated = true
    ) THEN
      RAISE EXCEPTION 'Produit en veille : avis désactivés.'
        USING DETAIL = 'reason=curated';
    END IF;
  END IF;

  -- Commentaires : fiche publiée + règles de parent (un seul niveau).
  IF TG_TABLE_NAME = 'comments' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Produit introuvable ou non publié.'
        USING DETAIL = 'reason=product_not_published';
    END IF;
    IF NEW.parent_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.id = NEW.parent_id
          AND (c.deleted_at IS NOT NULL OR c.product_id <> NEW.product_id)
      ) THEN
        RAISE EXCEPTION 'Commentaire parent introuvable (même produit, non supprimé).'
          USING DETAIL = 'reason=parent_not_found';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.id = NEW.parent_id AND c.parent_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Un seul niveau de réponse.'
          USING DETAIL = 'reason=reply_too_deep';
      END IF;
    END IF;
  END IF;

  -- Votes commentaire : le commentaire cible est visible (non supprimé)
  -- et sa fiche est publiée — sémantique exacte de toggleCommentVote.
  IF TG_TABLE_NAME = 'comment_votes' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.comments c
      JOIN public.products p ON p.id = c.product_id
      WHERE c.id = NEW.comment_id
        AND c.deleted_at IS NULL
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Commentaire introuvable ou fiche non publiée.'
        USING DETAIL = 'reason=parent_not_found';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bridge_writer_guard() IS
  'Garde 0055 : identité (JWT seulement), ban/suppression, âge 1 h, flood 20/60 s, avis/commentaires hors règles.';

DROP TRIGGER IF EXISTS bridge_reviews_guard ON public.reviews;
CREATE TRIGGER bridge_reviews_guard
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();
DROP TRIGGER IF EXISTS bridge_comments_guard ON public.comments;
CREATE TRIGGER bridge_comments_guard
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();
DROP TRIGGER IF EXISTS bridge_comment_votes_guard ON public.comment_votes;
CREATE TRIGGER bridge_comment_votes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();

-- Compteurs avis (deltas exacts, GREATEST au décompte = TS d'avant).
CREATE OR REPLACE FUNCTION public.bridge_reviews_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_sum int := 0;
  v_old_count int := 0;
  v_new_sum int := 0;
  v_new_count int := 0;
  v_product uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_sum   := CASE WHEN NEW.deleted_at IS NULL THEN NEW.rating ELSE 0 END;
    v_new_count := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := NEW.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_sum   := CASE WHEN OLD.deleted_at IS NULL THEN OLD.rating ELSE 0 END;
    v_old_count := CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_new_sum   := CASE WHEN NEW.deleted_at IS NULL THEN NEW.rating ELSE 0 END;
    v_new_count := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := NEW.product_id;
  ELSE
    v_old_sum   := CASE WHEN OLD.deleted_at IS NULL THEN OLD.rating ELSE 0 END;
    v_old_count := CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := OLD.product_id;
  END IF;

  IF (TG_OP = 'DELETE') OR (v_new_sum <> v_old_sum) OR (v_new_count <> v_old_count) THEN
    UPDATE public.products
    SET ratings_sum   = ratings_sum + (v_new_sum - v_old_sum),
        ratings_count = GREATEST(ratings_count + (v_new_count - v_old_count), 0)
    WHERE id = v_product;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bridge_reviews_write() IS
  'Avis 0055 : ratings_sum/ratings_count par delta (INSERT/UPDATE/DELETE), jamais de recalcul depuis zéro.';

DROP TRIGGER IF EXISTS bridge_reviews_write ON public.reviews;
CREATE TRIGGER bridge_reviews_write
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_reviews_write();

-- Notifs avis (review_received à la CRÉATION seule).
CREATE OR REPLACE FUNCTION public.bridge_reviews_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active boolean;
  v_maker uuid;
  v_name text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW; -- suppression soft : rien
  END IF;

  SELECT (p.deleted_at IS NULL AND p.status = 'published'), p.maker_id, p.name
    INTO v_active, v_maker, v_name
  FROM public.products p
  WHERE p.id = NEW.product_id;
  IF v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_maker IS NOT NULL AND v_maker <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
    VALUES (
      public.bridge_uuidv7(),
      v_maker,
      'review_received',
      NEW.product_id,
      NEW.user_id,
      'Nouvel avis sur ' || v_name || ' (' || NEW.rating || '/5)'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bridge_reviews_notify() IS
  'Avis 0055 : notification maker à la création (jamais l''édition, jamais soi-même).';

DROP TRIGGER IF EXISTS bridge_reviews_notify ON public.reviews;
CREATE TRIGGER bridge_reviews_notify
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_reviews_notify();

-- Compteurs commentaires.
CREATE OR REPLACE FUNCTION public.bridge_comments_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product uuid;
  v_delta int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_product := NEW.product_id;
    v_delta   := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_product := NEW.product_id;
    v_delta   := (CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END)
             - (CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END);
  ELSE
    v_product := OLD.product_id;
    v_delta   := -(CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END);
  END IF;

  IF v_delta <> 0 THEN
    UPDATE public.products
    SET comments_count = GREATEST(comments_count + v_delta, 0)
    WHERE id = v_product;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bridge_comments_write() IS
  'Commentaires 0055 : comments_count par delta (GREATEST au décompte), sémantique TS exacte.';

DROP TRIGGER IF EXISTS bridge_comments_write ON public.comments;
CREATE TRIGGER bridge_comments_write
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comments_write();

-- Notifs commentaires (maker + auteur du parent, sans doublons).
CREATE OR REPLACE FUNCTION public.bridge_comments_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active boolean;
  v_maker uuid;
  v_name text;
  v_parent_user uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT (p.deleted_at IS NULL AND p.status = 'published'), p.maker_id, p.name
    INTO v_active, v_maker, v_name
  FROM public.products p
  WHERE p.id = NEW.product_id;
  IF v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_maker IS NOT NULL AND v_maker <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
    VALUES (
      public.bridge_uuidv7(),
      v_maker,
      'comment_received',
      NEW.product_id,
      NEW.user_id,
      'Nouveau commentaire sur ' || v_name
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.user_id INTO v_parent_user
    FROM public.comments c
    WHERE c.id = NEW.parent_id
      AND c.deleted_at IS NULL;
    IF v_parent_user IS NOT NULL
       AND v_parent_user <> NEW.user_id
       AND v_parent_user <> v_maker THEN
      INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
      VALUES (
        public.bridge_uuidv7(),
        v_parent_user,
        'comment_replied',
        NEW.product_id,
        NEW.user_id,
        'Réponse à votre commentaire sur ' || v_name
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bridge_comments_notify() IS
  'Commentaires 0055 : maker (comment_received) + parent (comment_replied), jamais soi-même ni doublon.';

DROP TRIGGER IF EXISTS bridge_comments_notify ON public.comments;
CREATE TRIGGER bridge_comments_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comments_notify();

-- Score commentaires (RECOMPTE exact — sémantique TS identique).
CREATE OR REPLACE FUNCTION public.bridge_comment_votes_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comment uuid;
BEGIN
  v_comment := COALESCE(NEW.comment_id, OLD.comment_id);
  IF v_comment IS NOT NULL THEN
    UPDATE public.comments c
    SET score = COALESCE((
      SELECT sum(
        CASE WHEN cv.value = 'up' THEN 1
             ELSE -1
        END
      )
      FROM public.comment_votes cv
      WHERE cv.comment_id = v_comment
    ), 0)
    WHERE c.id = v_comment;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bridge_comment_votes_write() IS
  'Votes commentaires 0055 : comments.score par RECOMPTE sum(up/down), jamais d''incrément.';

DROP TRIGGER IF EXISTS bridge_comment_votes_write ON public.comment_votes;
CREATE TRIGGER bridge_comment_votes_write
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comment_votes_write();

-- Fermeture : EXECUTE interne seul — seuls les triggers appellent ces
-- fonctions. Quatre grantees, PAS UN SEUL : le REVOKE PUBLIC seul NE
-- SUFFIT PAS — les grants par défaut Supabase (ALTER DEFAULT PRIVILEGES
-- pour le rôle postgres) ajoutent à chaque CREATE un EXECUTE explicite
-- vers anon, authenticated et service_role, qui survit au REVOKE PUBLIC.
REVOKE EXECUTE ON FUNCTION public.bridge_uuidv7() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_writer_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_reviews_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_reviews_notify() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_comments_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_comments_notify() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_comment_votes_write() FROM PUBLIC, anon, authenticated, service_role;

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

-- Verrou colonnes sensibles (signalement équipe mobile, oct. 2026,
-- migration 0044 — garder les deux en sync) : la policy ci-dessus filtre
-- la LIGNE mais aucune COLONNE — sans ce trigger, tout client
-- authentifié pouvait `SET role = 'admin'`. Les identités de service
-- (Drizzle/postgres, service_role, supabase_admin) passent ; tout autre
-- appelant qui touche role, banned_at, email, username ou providers est
-- rejeté. Champs profil modifiables (non-breaking).
CREATE OR REPLACE FUNCTION public.lock_users_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.providers IS DISTINCT FROM OLD.providers THEN
    RAISE EXCEPTION 'colonnes protégées : role, banned_at, email, username, providers (service_role seul)';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_lock_sensitive ON public.users;
CREATE TRIGGER users_lock_sensitive
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_users_sensitive_columns();

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
ALTER TABLE public.product_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- featured_products : lecture publique autorisée (client mobile Flutter / web),
-- écritures service/admin uniquement (aucune policy insert/update/delete PostgREST).
ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "featured_products_read_public" ON public.featured_products;
CREATE POLICY "featured_products_read_public"
  ON public.featured_products
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = featured_products.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    )
  );

-- revenue_connections / revenue_snapshots : AUCUNE policy = refusé via
-- Data API (sinon n'importe qui lirait les clés chiffrées via PostgREST).
-- Lectures/écritures Drizzle serveur uniquement (service_role).
ALTER TABLE public.revenue_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;

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
  today              date    := (now() AT TIME ZONE 'UTC')::date;
  yesterday          date    := today - 1;
  chosen             uuid;
  total              integer;
  yesterday_product  uuid;
  attente_cap        integer;
BEGIN
  -- Idempotent : déjà calculé (ou épinglé) -> rien à faire
  SELECT product_id INTO chosen FROM public.featured_products WHERE featured_on = today;
  IF FOUND THEN RETURN chosen; END IF;

  -- Taille du catalogue éligible (veille exclue)
  SELECT COUNT(*)::int INTO total
    FROM public.products
   WHERE status = 'published' AND deleted_at IS NULL AND curated = false;
  IF total = 0 THEN RETURN NULL; END IF;

  -- Plafond d'attente dynamique : min(max(total - 1, 7), 30)
  attente_cap := LEAST(GREATEST(total - 1, 7), 30);

  -- Produit d'hier (à exclure si N >= 2)
  SELECT product_id INTO yesterday_product
    FROM public.featured_products WHERE featured_on = yesterday;

  WITH candidats AS (
    SELECT p.id,
           p.updated_at,
           p.published_at,
           -- Attente dynamique (jours depuis la dernière mise en avant ou
           -- la publication), plafonnée à attente_cap
           GREATEST(0, LEAST(attente_cap, COALESCE(
             (today - MAX(f.featured_on))::int - 1,
             (today - p.published_at::date)::int
           ))) AS attente,
           -- Signal multi-dimensionnel, log-scale + moyenne bayésienne
           LEAST(15.0,
             -- Note bayésienne (C=10, m=3.5) : équitable pour les nouveaux
             (35.0 + COALESCE(p.ratings_sum, 0)::numeric)
               / (10.0 + COALESCE(p.ratings_count, 0)::numeric)
             -- Votes pondérés 7j (log)
             + ln(1.0 + GREATEST(0, COALESCE((SELECT SUM(v.weight)::numeric FROM public.votes v
                                 WHERE v.product_id = p.id
                                   AND v.created_at >= now() - INTERVAL '7 days'), 0)))
             -- Commentaires 7j (log, poids 1.5)
             + 1.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.comments c
                               WHERE c.product_id = p.id
                                 AND c.created_at >= now() - INTERVAL '7 days'
                                 AND c.deleted_at IS NULL))
             -- Avis 7j (log, poids 2.5 — signal le plus fort)
             + 2.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.reviews r
                               WHERE r.product_id = p.id
                                 AND r.created_at >= now() - INTERVAL '7 days'
                                 AND r.deleted_at IS NULL))
             -- Vues de fiche 7j (log, poids 0.3)
             + 0.3 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_page_views pv
                               WHERE pv.product_id = p.id
                                 AND pv.created_at >= now() - INTERVAL '7 days'))
             -- Clics sortants 7j (log, poids 0.5)
             + 0.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_link_clicks lc
                               WHERE lc.product_id = p.id
                                 AND lc.created_at >= now() - INTERVAL '7 days'))
             -- Téléchargements APK 7j (log, poids 0.8)
             + 0.8 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_downloads pd
                               WHERE pd.product_id = p.id
                                 AND pd.created_at >= now() - INTERVAL '7 days'))
           ) AS signal
      FROM public.products p
      LEFT JOIN public.featured_products f ON f.product_id = p.id
     WHERE p.status = 'published'
       AND p.deleted_at IS NULL
       AND p.curated = false
       -- Garde-fou anti-consécutif : exclure le produit d'hier si N >= 2
       AND (total < 2 OR p.id IS DISTINCT FROM yesterday_product)
     GROUP BY p.id
  )
  SELECT c.id INTO chosen
    FROM candidats c
   ORDER BY 3 * c.attente + c.signal DESC,
            c.updated_at DESC,
            c.published_at DESC,
            c.id ASC
   LIMIT 1;

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
