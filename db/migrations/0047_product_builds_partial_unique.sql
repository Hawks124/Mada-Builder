-- 0047 : index unique PARTIEL sur (produit, version_code).
--
-- Pourquoi : l'index était UNIQUE sur (product_id, version_code) sans
-- condition. Un build REJETÉ gardait sa ligne (l'historique le montre :
-- « v2.0.1 (3) — Rejeté »), donc son numéro de version restait pris
-- définitivement : le maker ne pouvait pas re-soumettre son APK après
-- une correction de notes (« corrigez et re-soumettre » — le motif de
-- rejet le promettait) sans bumper son versionCode.
--
-- La règle de version (migration de logique, pas de schéma) compare
-- désormais le nouveau versionCode au build EN LIGNE (status
-- 'approved'), plus au max de tous les builds. L'index doit dire la
-- même chose : un (produit, version_code) ne peut exister qu'une fois
-- dans la piste VIVANTE (en revue ou en ligne). Un build rejeté ne
-- verrouille plus rien — l'historique le conserve, la version redevient
-- ré-insérable.
--
-- `version_code` NULL : les enregistrements bruts D1 (extraction
-- manifest en attente) ont un code NULL ; en SQL, NULL != NULL dans un
-- index unique → plusieurs lignes NULL par produit sont autorisées
-- (comportement inchangé, et le NULL n'entre pas dans la comparaison de
-- version).
DROP INDEX IF EXISTS public.product_builds_product_version_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS product_builds_product_version_uidx
  ON public.product_builds (product_id, version_code)
  WHERE status IN ('pending', 'approved');
