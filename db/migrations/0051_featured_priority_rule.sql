-- 0051 : la règle du produit du jour, en SQL (pg_cron à 00:05).
--
-- POURQUOI : l'ancien `rotate_featured_daily` enfilait les produits
-- (jamais-featuré d'abord, puis moins-récemment-featuré, avec une
-- fenêtre de 7 jours d'EXIGIBILITÉ). Trois défauts :
--   1. le slot pouvait être VIDE (tous les éligibles dans la fenêtre) ;
--   2. l'ordre dépendait de l'HEURE D'ARRIVÉE (une FIFO) ;
--   3. la fenêtre était un seuil figé.
--
-- La règle est désormais une PRIORITÉ, la même que celle du service
-- TypeScript (`services/ranking.service.ts`, `classerFeatured`) :
--
--   attente(p)  = min(jours depuis la dernière mise en avant — ou depuis
--                  sa publication si jamais mise en avant —, 7)
--   signal(p)   = note moyenne + votes PONDÉRÉS 7 j
--                  + 2 × commentaires 7 j + 3 × avis 7 j
--   priorité(p) = min(signal(p), 7) + 2 × attente(p)
--   tri = (priorité DESC, dernière activité DESC, publication DESC, id ASC)
--
-- L'attente est plafonnée (la file ne grossit pas), le signal aussi (un
-- produit très vote ne monopolise pas), et l'attente pèse double (celui
-- qui n'a pas eu sa part l'emporte sur le bruyant). Le slot ne peut
-- plus être vide tant qu'un produit éligible existe.
--
-- Les deux moteurs (SQL et TS) doivent choisir LE MÊME produit : le
-- script `verify-featured` compare les deux choix sur le même état →
-- ils ne peuvent pas diverger silencieusement.
CREATE OR REPLACE FUNCTION public.rotate_featured_daily() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  today date := (now() AT TIME ZONE 'UTC')::date;
  chosen uuid;
BEGIN
  -- Déjà calculé (idempotent, pin respecté) : rien à faire.
  SELECT product_id INTO chosen FROM public.featured_products WHERE featured_on = today;
  IF FOUND THEN RETURN chosen; END IF;

  -- Catalogue éligible (veille exclue) + la priorité.
  WITH candidats AS (
    SELECT p.id,
           p.published_at,
           p.updated_at,
           -- Attente : jours depuis la dernière mise en avant (ou depuis la
           -- publication si jamais mise en avant), plafonnés à 7 jours.
           LEAST(7, COALESCE(
             (CURRENT_DATE - MAX(f.featured_on))::int,
             (CURRENT_DATE - p.published_at::date)::int
           )) AS attente,
           -- Signal : qualité perçue (note moyenne) + activité de la
           -- semaine, borné à 7 points.
           LEAST(7,
             COALESCE(p.ratings_sum::numeric / NULLIF(p.ratings_count, 0), 0)
             + COALESCE((SELECT SUM(v.weight)::numeric FROM public.votes v
                          WHERE v.product_id = p.id AND v.created_at >= now() - INTERVAL '7 days'), 0)
             + 2 * (SELECT COUNT(*)::numeric FROM public.comments c
                      WHERE c.product_id = p.id AND c.created_at >= now() - INTERVAL '7 days')
             + 3 * (SELECT COUNT(*)::numeric FROM public.reviews r
                      WHERE r.product_id = p.id AND r.created_at >= now() - INTERVAL '7 days')
           ) AS signal
      FROM public.products p
      LEFT JOIN public.featured_products f ON f.product_id = p.id
     WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.curated = false
     GROUP BY p.id
  )
  SELECT c.id INTO chosen
    FROM candidats c
   ORDER BY LEAST(7, c.signal) + 2 * c.attente DESC,
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

COMMENT ON FUNCTION public.rotate_featured_daily() IS
  'Produit du jour : rotation par priorite (attente bornee + signal bornee). Meme regle que le service TypeScript.';
