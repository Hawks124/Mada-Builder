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
