-- 0064 : T6-bis — élargissement ADDITIF de la surface PostgREST de
-- `product_builds` : +3 colonnes publiques (`cert_sha256`, `min_sdk`,
-- `target_sdk`) aux rôles client (anon + authenticated).
--
-- Ticket canal (2026-11-04) : depuis l'épure côté natif —
-- `fetchProductDetail` (la fiche `GET /api/v1/products/{id}`),
-- son provider et son parseur sont SUPPRIMÉS des sources mobiles —
-- la fiche produit mobile lit TOUT en direct PostgREST : l'embed
-- `product_builds` est la source unique (1 requête au lieu de 2 par
-- vue). Ces 3 colonnes sont les dernières dont le natif a besoin pour
-- fermer sa fiche — et la dernière lecture API v1 disparaît au profit
-- de l'embed (l'API ne reste consommée que pour : écritures
-- anti-abuse, updates/check, download et auth).
--
-- Pourquoi elles sont publiques par nature (code = arbitre, avis rendu) :
-- - `cert_sha256` : SHA-256 du certificat de signature de l'APK —
--   extractible par QUICONQUE tient l'APK (apksigner). Il sert au
--   pinning de certificat côté natif (CERT_MISMATCH vérifié AVANT
--   install — anti mix-up) ;
-- - `min_sdk` / `target_sdk` : requirements Android déclarés dans
--   l'APK, exposés publiquement par Google Play également. Ils
--   permettent au natif de refuser AVANT le téléchargement un binaire
--   incompatible (SDK) — enjeu réel sur données mobiles locales.
--
-- La doctrine 0062 explicitait : « cert_* / min_sdk / target_sdk ne
-- sont PAS grantées : le mobile les consomme par l'API v1 (serveur) ».
-- C'est CETTE hypothèse qui est déchue — désormais un fait de code du
-- canal natif (services supprimés, selects élargis avec doc-comment
-- « GATE DE RELEASE » à 13 colonnes listées explicitement chez eux ;
-- notre verify-0064 verrouille LA MÊME liste en littéral).
--
-- ADDITIF : les grants de colonne S'ACCUMULENT en Postgres — les
-- dix colonnes de 0062 restent grantées, les 3 ici s'ajoutent (total :
-- 13 colonnes, liste verrouillée côté natif ET côté verify).
-- RLS/policy 0053 STRICTEMENT inchangées : le RLS arbitre QUELLES
-- lignes (approuvés publics + own), le grant arbitre désormais quelles
-- COLONNES (13). `r2_key` reste HORS de la liste : toute requête qui
-- la cible — et `select=*` a fortiori — meurt en 42501 franche,
-- invariant intact.
--
-- Idempotent : re-GRANT est sans effet. Rollback minuscule si besoin :
--   REVOKE SELECT (cert_sha256, min_sdk, target_sdk)
--     ON public.product_builds FROM anon, authenticated;
-- (aucun objet ni donnée manipulés — retour instantané à la surface 0062.)

GRANT SELECT (
  cert_sha256,
  min_sdk,
  target_sdk
) ON public.product_builds TO anon;
--> statement-breakpoint
GRANT SELECT (
  cert_sha256,
  min_sdk,
  target_sdk
) ON public.product_builds TO authenticated;
