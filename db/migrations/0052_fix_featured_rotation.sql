-- 0052 : Algorithme produit du jour enterprise-grade.
--
-- Trois principes :
--   1. Équité       : moyenne bayésienne (C=10, m=3.5) -> 1 avis 5★ ne bat pas 100 avis 4.8★
--   2. Non-linéaire : ln(1+x) sur tous les compteurs -> retours décroissants
--   3. Scalable     : attente_cap = min(max(N-1, 7), 30) -> s'adapte automatiquement de 3 à 1 000 000
--
-- Multi-signaux : votes pondérés, comments, reviews, page_views, link_clicks, downloads
-- Garde-fou    : anti-consécutif dur (produit d'hier exclu si N >= 2)
-- Mobile fix   : RLS SELECT public sur featured_products (précédemment deny-all)

DROP POLICY IF EXISTS "featured_products_read_public" ON public.featured_products;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
COMMENT ON FUNCTION public.rotate_featured_daily() IS
  'Produit du jour enterprise-grade : équitable (bayésien), non-linéaire (ln), scalable (attente_cap=min(max(N-1,7),30)). Parité TS garantie par verify:featured.';
