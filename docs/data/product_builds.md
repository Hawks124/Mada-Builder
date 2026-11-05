# `product_builds` — binaires APK (D1)

Historique complet des builds par produit (rollback possible, traçabilité).
Un build = un objet R2 (bucket **privé** `product-builds`) + métadonnées.
Statut : `pending` → revu (D4, bloquant) → `approved` téléchargeable.

| Colonne        | Type                                | Notes                                                                                    |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`           | `uuid` PK (v7)                      |                                                                                          |
| `product_id`   | `uuid` FK → `products` CASCADE      | Suppression produit = builds purgés (objets R2 via sweep)                                |
| `version_code` | `integer` NULL                      | NULL = brut D1 (extraction manifest en D2) ; UNIQUE/produit                              |
| `version_name` | `text` NULL                         | Affichage (ex. 2.4.1)                                                                    |
| `package`      | `text` NULL                         | Ex. com.ex.app — clé d'unicité filière (D2)                                              |
| `min_sdk`      | `integer` NULL                      | Compatibilité (warning seul, jamais bloquant)                                            |
| `target_sdk`   | `integer` NULL                      | Info revue                                                                               |
| `permissions`  | `text[]` NOT NULL DEFAULT `{}`      | Dangereuses affichées fiche (transparence)                                               |
| `cert_sha256`  | `text` NULL                         | Pinning updates (D2/D4, intersection)                                                    |
| `cert_sha1`    | `text` NULL                         | Compat Play                                                                              |
| `sig_scheme`   | `text` NULL                         | `v2` / `v3` / `v1` (v1-only = warning)                                                   |
| `sha256_file`  | `text` NOT NULL                     | Intégrité (64 hex, vérifié au download mobile)                                           |
| `size_bytes`   | `bigint` NOT NULL                   | Quota 300 Mo (présignature + HEAD, borne `lib/apk-limits.ts`)                            |
| `r2_key`       | `text` NOT NULL                     | `builds/{maker}/{produit}/{stamp}-{rand}.apk` (confiné, jamais lisible PostgREST — 0062) |
| `whatsnew`     | `text` NULL                         | Notes de version (requises si track, 1000 signes, D4)                                    |
| `status`       | `text` NOT NULL DEFAULT `'pending'` | `pending` / `approved` / `rejected`                                                      |
| `created_at`   | `timestamptz` NOT NULL              | Ordre versions + section « Mises à jour » (D6)                                           |

Index : UNIQUE `(product_id, version_code)`, `(product_id, created_at)`.

## Accès (migrations 0062 T6 + 0064 T6-bis)

Le RLS arbitre les **lignes** (policy 0053 inchangée : approuvés publics +
les builds du maker), le GRANT arbitre les **colonnes** : la treizaine
que le canal natif consomme est grantée à `anon`/`authenticated` —
`id, product_id, version_code, version_name, package, size_bytes,
whatsnew, status, sha256_file, created_at` + **`cert_sha256`,
`min_sdk`, `target_sdk`** (0064 — T6-bis : la doctrine « consommés par
l'API v1 » est déchue, le natif lit désormais tout son fiche en direct
PostgREST ; les 3 colonnes sont publiques par nature — `cert_sha256`
extractible par quiconque tient l'APK, SDK exposables publiquement par
Play. Liste verrouillée des deux côtés : services natifs L27-40/L19-32
et `verify-0064` en littéral dur). `r2_key` est **hors de la
liste** : toute requête qui la cible (et a fortiori un `select=*`) tombe
sur un `42501` franche — c'est le correctif du trou T6 (le GRANT
full-row de 0053 expose toutes les colonnes dès que la ligne est
visible). Le serveur web (rôle propriétaire, Drizzle) lit tout ; le
pipeline D1→D6 n'est pas touché.

## Règles

- Upload **direct R2** (PUT présigné, jamais via Vercel — limite 4,5 Mo) ;
  quota + type vérifiés AVANT signature, taille re-vérifiée au HEAD.
- Confinement : `builds/{makerId}/{productId}/` ; clé étrangère = refus +
  objet purgé ; taille menteuse = refus + objet purgé (jamais d'orphelin).
- Doublon (produit, version) = refus + purge objet.
- APK universel only (splits/AAB refusés avec doc). Debug/profile refusés (D2+).
- Signature : v1+v2+v3 **recommandés** (téléphones < Android 7 n'installent
  que sur v1) ; v2/v3-only acceptés si les certificats du bloc sont lisibles.
  Refus différenciés de l'analyse — `UNSIGNED` : aucun bloc ni META-INF ;
  `BLOCK_UNREADABLE` : bloc v2/v3 détecté mais certs illisibles ;
  `V1_UNREADABLE` : entrées JAR illisibles ; `DEBUG_CERT` : clé debug ;
  `CERT_FAILED` : blob X.509 non parsé. Fail-closed dans tous les cas.
- Écritures : service seul (`createBuild`), jamais de direct PostgREST.
  Lectures PostgREST : approuvés publics + own (policy 0053), sur les
  treize colonnes grantées uniquement (0062 + 0064 — `r2_key` jamais
  exposée).

## Usage mobile

- Presign : `POST /api/v1/uploads/presign` `{ kind: "apk", productId, contentLength }`
  → `{ url, key, expiresIn }` (PUT direct, 15 min).
- Record : `POST /api/v1/products/[id]/builds`
  `{ r2Key, sha256, sizeBytes, versionCode?, versionName? }` → `{ buildId }` (201).
- Download (D5) : URL GET signée courte, builds approuvés uniquement.
- Install = job mobile (un tap, PackageInstaller) — jamais silencieux sur stock.
