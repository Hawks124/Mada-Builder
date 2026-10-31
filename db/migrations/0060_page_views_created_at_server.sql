-- 0060 — Vues de fiche : `created_at` devient un fait SERVEUR (CodeRabbit).
--
-- Pourquoi : `product_page_views` acceptait les INSERT anon/authenticated
-- avec `WITH CHECK (true)` (0053, journalisation de vue sans compte et sans
-- PII) et un GRANT INSERT table-level — le client pouvait donc choisir
-- `created_at`, y compris une date FUTURE qui prolonge la fenêtre 7 jours
-- du signal `0.3 * ln(1 + vues)` du produit du jour (0052 côté SQL,
-- ranking.service.ts côté TS). L'anti-burst 0054 plafonne `view_count`,
-- pas le signal de ranking qui compte les lignes brutes.
--
-- Le fix atteint la SOURCE du signal, pas la requête (parité garantee):
--   1. les lignes existantes à date future sont recadrées à maintenant ;
--   2. un trigger BEFORE INSERT impose `NEW.created_at := now()` — quel
--      que soit ce que le client envoie, la colonne n'est plus sienne ;
--   3. la rotation SQL re-crée le terme vues AVEC la borne haute
--      `created_at <= now()` — même règle côté TS (ranking.service), la
--      parité verify:featured reste vraie et les lignes historiques déjà
--      injectées (quel que soit leur bug d'époque) ne comptent qu'une
--      seule fois dans leur fenêtre effective.

UPDATE public.product_page_views
   SET created_at = now()
 WHERE created_at > now();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_product_page_view_created_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- L'horodatage n'appartient au client : n'importe quel INSERT (anon,
  -- authenticated, service) part à moment précis de son exécution.
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tr_product_page_views_created_at ON public.product_page_views;
--> statement-breakpoint
CREATE TRIGGER tr_product_page_views_created_at
BEFORE INSERT ON public.product_page_views
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_page_view_created_at();
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
             -- Vues de fiche 7j (log, poids 0.3) — BORNEE des deux côtés
             -- (0060) : le client ne fixe plus created_at, et l'anti-venge
             -- effectif rejette les lignes d'une fenêtre déjà soldée.
             + 0.3 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_page_views pv
                               WHERE pv.product_id = p.id
                                 AND pv.created_at >= now() - INTERVAL '7 days'
                                 AND pv.created_at <= now()))
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
  'Produit du jour enterprise-grade : équitable (bayésien), non-linéaire (ln), scalable (attente_cap=min(max(N-1,7),30)). Fenêtre 7j bornée created_at <= now() (0060). Parité TS garantie par verify:featured.';
