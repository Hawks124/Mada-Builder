-- 0053 : synchronisation du schéma partagé avec l'équipe mobile (option B).
--
-- CONTEXTE : le mobile gérait son côté via `supabase_patch.sql` dans SON
-- repo, et une version antérieure de ce patch avait posé un TRIGGER sur
-- product_downloads alors que la route web incrémentait déjà le compteur —
-- chaque téléchargement était compté DEUX fois (bug démasqué par
-- verify-products-backend, corrigé le 2026-10-27).
--
-- DÉCISION COMMUNE (option B, 2026-10-27) :
--   · Téléchargements : `download_count` est incrémenté UNIQUEMENT par le
--     serveur web (services/builds.service.ts, recordDownload : INSERT de
--     l'événement + UPDATE atomique), appelé par la route
--     /api/v1/products/[id]/download. AUCUN trigger sur
--     `product_downloads` — trigger + route = double comptage, et le test
--     verify-products-backend casse s'il reparaît.
--   · Vues : l'app mobile journalise l'événement en anonyme (PostgREST) ;
--     le trigger DB alimente `view_count` (signal doux, sans rate-limit
--     côté app — anti-abus à couvrir dans un lot ultérieur).
--   · Schéma : ce fichier est le miroir idempotent de `supabase_patch.sql`
--     (version corrigée, exécutée par l'opérateur dans Supabase le
--     2026-10-27). Fin du « deux repos écrivent le même SQL » : toute
--     évolution de schéma passe désormais par une migration web (PR,
--     revue croisée web+mobile). Une base neuve posée de zéro
--     (0000 → 0053) reproduit l'état exact de la base partagée.
--
-- Les recalages UPDATE ci-dessous sont volontairement INCONDITIONNELS
-- (miroir fidèle du patch) : re-compter depuis les tables événements est
-- correct par construction (COUNT = vérité) et répare tout écart
-- résiduel — dont le +2 d'avant le retrait du trigger downloads.

-- 1. Compteur de vues dénormalisé sur products (lecture PostgREST sub-1ms
--    par le mobile ; détention : trigger DB en section 2).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE public.products p
SET view_count = COALESCE((
  SELECT COUNT(*)::int
  FROM public.product_page_views pv
  WHERE pv.product_id = p.id
), 0);
--> statement-breakpoint

-- 2. `product_page_views` : INSERT anonyme (journalisation de vue), lecture
--    restreinte au maker du produit ; UPDATE/DELETE interdits.
ALTER TABLE public.product_page_views
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.product_page_views ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "product_page_views_insert_public" ON public.product_page_views;
--> statement-breakpoint
CREATE POLICY "product_page_views_insert_public"
ON public.product_page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "product_page_views_select_own" ON public.product_page_views;
--> statement-breakpoint
CREATE POLICY "product_page_views_select_own"
ON public.product_page_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_page_views.product_id AND p.maker_id = auth.uid()
  )
);
--> statement-breakpoint
GRANT SELECT, INSERT ON public.product_page_views TO anon, authenticated;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.product_page_views FROM anon, authenticated;
--> statement-breakpoint
-- Trigger du compteur de vues : l'unique chemin d'incrémentation de
-- view_count (le web n'incrémente jamais lui-même).
CREATE OR REPLACE FUNCTION public.handle_product_page_view_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET view_count = view_count + 1
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tr_product_page_view_inserted ON public.product_page_views;
--> statement-breakpoint
CREATE TRIGGER tr_product_page_view_inserted
AFTER INSERT ON public.product_page_views
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_page_view_inserted();
--> statement-breakpoint

-- 3. `product_downloads` : tout SAUF le trigger (voir note).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.product_downloads
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.product_downloads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE public.products p
SET download_count = COALESCE((
  SELECT COUNT(*)::int
  FROM public.product_downloads pd
  WHERE pd.product_id = p.id
), 0);
--> statement-breakpoint
DROP POLICY IF EXISTS "product_downloads_insert_public" ON public.product_downloads;
--> statement-breakpoint
CREATE POLICY "product_downloads_insert_public"
ON public.product_downloads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "product_downloads_select_own" ON public.product_downloads;
--> statement-breakpoint
CREATE POLICY "product_downloads_select_own"
ON public.product_downloads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_downloads.product_id AND p.maker_id = auth.uid()
  )
);
--> statement-breakpoint
GRANT SELECT, INSERT ON public.product_downloads TO anon, authenticated;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.product_downloads FROM anon, authenticated;
--> statement-breakpoint
-- NOTE (option B) : PAS de trigger d'incrémentation ici.
-- Le compteur download_count est incrémenté exclusivement par le serveur
-- web via la route /api/v1/products/[id]/download, après tous les
-- contrôles (produit publié, build approuvé, rate-limit IP). L'app mobile
-- n'écrit plus directement dans product_downloads (2026-10-27). Ajouter un
-- trigger ferait compter chaque téléchargement deux fois — le test
-- verify-products-backend échoue si le trigger reparaît.
--> statement-breakpoint

-- 4. Vue sécurisée `public_makers` : lecture publique restreinte,
--    JAMAIS d'email. Drop+Create (et non CREATE OR REPLACE) : la liste de
--    colonnes d'une vue ne se modifie pas par OR REPLACE. Règles : makers
--    avec produit publié, OU avis/commentaire public, OU soi-même ;
--    bannis et supprimés exclus. (security_invoker = false : fit à la
--    doctrine mobile, since le propriétaire lit les tables jointes.)
DROP VIEW IF EXISTS public.public_makers;
--> statement-breakpoint
CREATE VIEW public.public_makers
WITH (security_invoker = false) AS
SELECT
  u.id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.occupation,
  u.bio,
  u.website_url,
  u.social_links,
  u.country,
  u.city,
  u.created_at,
  COUNT(p.id) FILTER (WHERE p.status = 'published' AND p.deleted_at IS NULL)::int AS published_products_count
FROM public.users u
LEFT JOIN public.products p ON p.maker_id = u.id
WHERE u.deleted_at IS NULL
  AND u.banned_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.products prod
      WHERE prod.maker_id = u.id
        AND prod.status = 'published'
        AND prod.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.reviews rev
      WHERE rev.user_id = u.id
    )
    OR EXISTS (
      SELECT 1 FROM public.comments com
      WHERE com.user_id = u.id
    )
    OR u.id = auth.uid()
  )
GROUP BY u.id;
--> statement-breakpoint
REVOKE ALL ON public.public_makers FROM anon, authenticated, public;
--> statement-breakpoint
GRANT SELECT ON public.public_makers TO anon, authenticated;
--> statement-breakpoint

-- 5. `user_devices` : gestion multi-appareils + tokens FCM + broadcast
--    invités (user_id NULL). FIX SÉCURITÉ du patch initial : la policy
--    SELECT était TO anon USING (true) — tous les tokens FCM lisibles par
--    quiconque tient la clé publique. Dorénavant : lecture = soi-même
--    (authenticated), anon garde juste INSERT/UPDATE pour enregistrer son
--    appareil et ne lit RIEN.
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE CASCADE,
  fcm_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
  ON public.user_devices (user_id) WHERE user_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_token
  ON public.user_devices (fcm_token);
--> statement-breakpoint
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_select_own" ON public.user_devices;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_select_policy" ON public.user_devices;
--> statement-breakpoint
CREATE POLICY "user_devices_select_policy"
ON public.user_devices FOR SELECT
TO authenticated
USING (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_insert_policy" ON public.user_devices;
--> statement-breakpoint
CREATE POLICY "user_devices_insert_policy"
ON public.user_devices FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_upsert_policy" ON public.user_devices;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_update_policy" ON public.user_devices;
--> statement-breakpoint
CREATE POLICY "user_devices_update_policy"
ON public.user_devices FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
--> statement-breakpoint
-- anon : écrire sans lire (tokens FCM jamais exposés aux sessions
-- anonymes) ; authenticated : lecture+écriture de ses appareils.
REVOKE SELECT ON public.user_devices FROM anon;
--> statement-breakpoint
GRANT INSERT, UPDATE ON public.user_devices TO anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.user_devices TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.handle_user_device_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_seen_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tr_user_device_updated_at ON public.user_devices;
--> statement-breakpoint
CREATE TRIGGER tr_user_device_updated_at
BEFORE UPDATE ON public.user_devices
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_device_updated_at();
--> statement-breakpoint

-- 6. RLS de `product_revisions` (accessibles au maker propriétaire), et
--    garde-fous de lecture : produits non-supprimés (published ou les siens),
--    builds approuvés (ou ceux du makers).
ALTER TABLE public.product_revisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "product_revisions_select_own" ON public.product_revisions;
--> statement-breakpoint
CREATE POLICY "product_revisions_select_own"
ON public.product_revisions FOR SELECT
TO authenticated
USING (
  maker_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_revisions.product_id AND p.maker_id = auth.uid()
  )
);
--> statement-breakpoint
DROP POLICY IF EXISTS "product_revisions_insert_own" ON public.product_revisions;
--> statement-breakpoint
CREATE POLICY "product_revisions_insert_own"
ON public.product_revisions FOR INSERT
TO authenticated
WITH CHECK (
  maker_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_revisions.product_id AND p.maker_id = auth.uid()
  )
);
--> statement-breakpoint
GRANT SELECT, INSERT ON public.product_revisions TO authenticated;
--> statement-breakpoint
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "products_select_published_or_own" ON public.products;
--> statement-breakpoint
CREATE POLICY "products_select_published_or_own"
ON public.products FOR SELECT
TO anon, authenticated
USING (
  (status = 'published' AND deleted_at IS NULL)
  OR maker_id = auth.uid()
);
--> statement-breakpoint
ALTER TABLE public.product_builds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "product_builds_select_approved_or_own" ON public.product_builds;
--> statement-breakpoint
CREATE POLICY "product_builds_select_approved_or_own"
ON public.product_builds FOR SELECT
TO anon, authenticated
USING (
  status = 'approved'
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_builds.product_id AND p.maker_id = auth.uid()
  )
);
--> statement-breakpoint
GRANT SELECT ON public.product_builds TO anon, authenticated;
