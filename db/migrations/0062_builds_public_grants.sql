-- 0062 : T6 (sécurité) — `r2_key` n'est plus lisible via PostgREST.
--
-- Ticket squad mobile : depuis 0053, la policy
-- `product_builds_select_approved_or_own` rend les builds approuvés
-- publics (voulu — c'est aussi le moteur du listing APK dispo), mais
-- le GRANT SELECT pleine ligne expose TOUTES les colonnes dès que la
-- ligne est visible, `r2_key` y compris : RLS est row-level only, la
-- colonne n'a JAMAIS été arbitrée. Quiconque tient l'anon key lit
-- ainsi les clés d'objets R2 (noms, arborescence du bucket) de tous
-- les builds approuvés — pas d'accès objet direct (bucket privé),
-- mais contredit l'invariant « clés confinées / jamais de clé
-- publique » (docs/apk-moteur.md §11 invariant 2) et expose la
-- structure interne du stockage.
--
-- Correctif (grants colonne, la voie demandée par la squad) :
--   1. REVOKE ALL (anon + authenticated) — surface RECONSTRUITE de
--      façon déterministe plutôt que de s'empiler sur des grants
--      résiduels (même doctrine que 0059) ;
--   2. GRANT SELECT colonne-par-colonne, `r2_key` ABSENTE de la liste
--      — toute requête qui la cible (même `select=r2_key`, et un
--      `select=*` a fortiori) tombe sur un 42501 « permission denied »
--      franche : Postgres refuse la requête entière dès qu'une colonne
--      non grantée est demandée ;
--   3. la policy 0053 reste EXACTEMENT la même — les approuvés sont
--      publics, le maker voit ses propres builds ; le RLS arbitre
--      toujours QUELLES lignes, le grant arbitre désormais quelles
--      colonnes.
--
-- Colonnes grantées : les dix que le canal natif consomme — id,
-- product_id, version_code, version_name, package, size_bytes,
-- whatsnew, status, sha256_file, created_at (collées à la demande
-- squad). Les colonnes cert_* / sig_scheme / rejection_reason /
-- reviewed_* / min_sdk / target_sdk / permissions ne sont PAS
-- grantées : le mobile les consomme par l'API v1 (serveur) et non par
-- l'embed PostgREST — la surface anonyme reste minimale.
--
-- Idempotent : ré-appliquer est sans effet. Le web ne change RIEN :
-- les lectures serveur passent par le rôle propriétaire (Drizzle),
-- hors RLS et hors grants applicatifs.

ALTER TABLE public.product_builds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.product_builds FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.product_builds FROM authenticated;
--> statement-breakpoint
GRANT SELECT (
  id,
  product_id,
  version_code,
  version_name,
  package,
  size_bytes,
  whatsnew,
  status,
  sha256_file,
  created_at
) ON public.product_builds TO anon;
--> statement-breakpoint
GRANT SELECT (
  id,
  product_id,
  version_code,
  version_name,
  package,
  size_bytes,
  whatsnew,
  status,
  sha256_file,
  created_at
) ON public.product_builds TO authenticated;
