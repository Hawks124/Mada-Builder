-- 0054 : lot B — jobs planifiés + anti-abuse des compteurs.
--
-- Quatre chantiers, tous idempotents :
--
--   1. VERROU DIGEST : table `digests_sent` (une ligne par semaine ISO).
--      Le second `sendWeeklyDigest` de la même semaine devient un no-op —
--      un re-run (workflow_dispatch, double schedule) n'envoie plus l'email
--      à toutes les personnes inscrites une deuxième fois.
--
--   2. `product_downloads` : écriture PostgREST FERMÉE. Depuis l'option B
--      (2026-10-27), l'app mobile n'insère PLUS directement dans cette
--      table — la route serveur (/api/v1/products/[id]/download) insère
--      sous le rôle postgres (bypass RLS). La policy `insert_public`
--      (posée par le patch mobile dans un contexte d'usage devenu
--      obsolète) n'a donc AUCUN client légitime : elle ne servait qu'à
--      gonfler le compteur avec la clé publique. On ferme à la source.
--      Contrat mis à jour : docs/mobile-contrats.md.
--
--   3. VUES : l'INSERT anon RESTE (chemin de journalisation des vues de
--      l'app mobile), mais le trigger reçoit un ANTI-BURST : au-delà de
--      60 événements pour un même produit dans la dernière minute,
--      l'événement reste stocké (audit) sans gonfler `view_count`. Un
--      flood n'influence plus le classement (l'algo produit du jour lit
--      les vues) — reste le coût de stockage des événements, documenté
--      dans architecture.md (section vues).
--
--   4. PG_CRON : les schedules de jobs (score, produit du jour, purge
--      brouillons) ne vivaient QUE dans `setup.sql` — une base
--      reconstruite par migrations seule perdait tous ses jobs. La
--      migration re-pose les schedules (idempotent, garde à la présence
--      des fonctions cibles) et ajoute un recomptage QUOTIDIEN en SQL du
--      compteur de téléchargements (`recount_download_counts`) — le
--      relais TS `scripts/run-jobs.ts` redevient un filet (plus
--      le seul chemin).

-- 1. Verrou digest hebdo (anti-doublon) — doctrine deny-all : RLS
--    activé, AUCUNE policy (écritures service seules, comme
--    `idempotency_keys`).
CREATE TABLE IF NOT EXISTS public.digests_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week text NOT NULL UNIQUE,
  eligible integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE public.digests_sent IS
  'Verrou anti-doublon du digest hebdo : une ligne par semaine ISO (YYYY-Www). Service seuls.';
--> statement-breakpoint
ALTER TABLE public.digests_sent ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 2. product_downloads : le service est le seul écrivain.
DROP POLICY IF EXISTS "product_downloads_insert_public" ON public.product_downloads;
--> statement-breakpoint
REVOKE INSERT ON public.product_downloads FROM anon, authenticated;
--> statement-breakpoint

-- 3. Trigger vues : ANTI-BURST. Au-delà du cap (~60/min/produit), le
--    compteur NE s'incrémente PLUS — l'événement reste stocké (audit),
--    jamais le trafic légitime (60 vues/min sur une même fiche = flood,
--    pas de lecture humaine).
CREATE OR REPLACE FUNCTION public.handle_product_page_view_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT COUNT(*)::int INTO recent
    FROM public.product_page_views
   WHERE product_id = NEW.product_id
     AND created_at > now() - interval '60 seconds';
  IF recent <= 60 THEN
    UPDATE public.products
      SET view_count = view_count + 1
     WHERE id = NEW.product_id;
  END IF;
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
-- Index pour la requête anti-burst (l'index `product_page_views_product_created_idx`
-- du schéma web couvre déjà la colonne ; ici la version (product_id, created_at DESC)
-- est la redondance idempotente — jamais une deuxième source de vérité).
CREATE INDEX IF NOT EXISTS product_page_views_burst_idx
  ON public.product_page_views (product_id ASC, created_at DESC);
--> statement-breakpoint

-- 4a. Recomptage SQL du compteur de téléchargements (miroir fidèle du job
--     `recountDownloadCounts` TS : deux phases, zéro manquant).
CREATE OR REPLACE FUNCTION public.recount_download_counts() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products p
     SET download_count = sub.n
    FROM (
      SELECT product_id, COUNT(*)::int AS n
        FROM public.product_downloads
       GROUP BY product_id
    ) sub
   WHERE p.id = sub.product_id
     AND p.download_count <> sub.n;
  UPDATE public.products p
     SET download_count = 0
   WHERE p.download_count <> 0
     AND NOT EXISTS (SELECT 1 FROM public.product_downloads d WHERE d.product_id = p.id);
END;
$$;
--> statement-breakpoint

-- 4b. Schedules pg_cron (garde extension + garde fonctions cibles).
--     ATTENTION idempotence : `cron.unschedule(name)` LÈVE une erreur
--     (« could not find valid entry ») quand l'entrée est absente —
--     toujours guarder l'unschedule par un SELECT sur `cron.job`, sinon
--     un job NOUVEAU (base fraîche) ne serait jamais posé.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '0054: pg_cron indisponible — schedules non posés (relais : scripts/run-jobs.ts + /api/cron/maintenance).';
      RETURN;
    END;
  END IF;

  -- Score leaderboard (15 min) — fonction posée par setup.sql : sautée
  -- (avec notice) sur une base reconstruite par migrations seule.
  IF to_regproc('public.recompute_product_scores') IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'product-scores-15min') THEN
        PERFORM cron.unschedule('product-scores-15min');
      END IF;
      PERFORM cron.schedule('product-scores-15min', '*/15 * * * *',
                            'SELECT public.recompute_product_scores()');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '0054: schedule product-scores-15min non posé (échec ignoré — relais applicatif).';
    END;
  ELSE
    RAISE NOTICE '0054: recompute_product_scores absente (setup.sql) — schedule score ignoré.';
  END IF;

  -- Produit du jour (quotidien 00:05 UTC) — fonction migrée (0052).
  IF to_regproc('public.rotate_featured_daily') IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'featured-daily') THEN
        PERFORM cron.unschedule('featured-daily');
      END IF;
      PERFORM cron.schedule('featured-daily', '5 0 * * *',
                            'SELECT public.rotate_featured_daily()');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '0054: schedule featured-daily non posé (échec ignoré — relais applicatif).';
    END;
  ELSE
    RAISE NOTICE '0054: rotate_featured_daily absente — schedule featured ignoré.';
  END IF;

  -- Purge des brouillons fantômes (mensuel) — fonction setup.sql.
  IF to_regproc('public.purge_stale_drafts') IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drafts-purge-monthly') THEN
        PERFORM cron.unschedule('drafts-purge-monthly');
      END IF;
      PERFORM cron.schedule('drafts-purge-monthly', '30 3 1 * *',
                            'SELECT public.purge_stale_drafts()');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '0054: schedule drafts-purge-monthly non posé (échec ignoré — relais applicatif).';
    END;
  ELSE
    RAISE NOTICE '0054: purge_stale_drafts absente (setup.sql) — schedule purge ignoré.';
  END IF;

  -- Recomptage téléchargements (quotidien 03:20 UTC) — fonction de CETTE
  -- migration (toujours présente ici).
  BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'download-counts-daily') THEN
      PERFORM cron.unschedule('download-counts-daily');
    END IF;
    PERFORM cron.schedule('download-counts-daily', '20 3 * * *',
                          'SELECT public.recount_download_counts()');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '0054: schedule download-counts-daily non posé (échec ignoré — relais applicatif).';
  END;
END
$do$;
--> statement-breakpoint
