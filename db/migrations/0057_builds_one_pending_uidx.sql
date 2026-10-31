-- 0057 — Un seul build PENDING par produit (pré-check 2026-10-29 : 0
-- doublon, 0 pending, 12 builds — l'index s'applique sans nettoyage).
--
-- Pourquoi : la garde du service (`stillPending`, read-then-write dans
-- createBuild) laisse une course — deux envois simultanés lisent tous
-- deux « rien en revue » et insèrent tous deux. Avec l'index partiel,
-- la base reste l'arbitre : le second INSERT lève 23505
-- (contrainte product_builds_one_pending_uidx), le service purge
-- l'objet orphelin et répond le message « déjà en revue ». Le pré-check
-- est conservé (chemin rapide, message dédié), l'index le renforce.
--
-- Table service-side (RLS deny-all, D1) : aucune policy à toucher.
CREATE UNIQUE INDEX product_builds_one_pending_uidx
ON public.product_builds (product_id)
WHERE status = 'pending';
