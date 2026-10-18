# `product_builds` — binaires APK (D1)

Historique complet des builds par produit (rollback possible, traçabilité).
Un build = un objet R2 (bucket **privé** `product-builds`) + métadonnées.
Statut : `pending` → revu (D4, bloquant) → `approved` téléchargeable.

| Colonne        | Type                                | Notes                                                         |
| -------------- | ----------------------------------- | ------------------------------------------------------------- |
| `id`           | `uuid` PK (v7)                      |                                                               |
| `product_id`   | `uuid` FK → `products` CASCADE      | Suppression produit = builds purgés (objets R2 via sweep)     |
| `version_code` | `integer` NULL                      | NULL = brut D1 (extraction manifest en D2) ; UNIQUE/produit   |
| `version_name` | `text` NULL                         | Affichage (ex. 2.4.1)                                         |
| `package`      | `text` NULL                         | Ex. com.ex.app — clé d'unicité filière (D2)                   |
| `min_sdk`      | `integer` NULL                      | Compatibilité (warning seul, jamais bloquant)                 |
| `target_sdk`   | `integer` NULL                      | Info revue                                                    |
| `permissions`  | `text[]` NOT NULL DEFAULT `{}`      | Dangereuses affichées fiche (transparence)                    |
| `cert_sha256`  | `text` NULL                         | Pinning updates (D2/D4, intersection)                         |
| `cert_sha1`    | `text` NULL                         | Compat Play                                                   |
| `sig_scheme`   | `text` NULL                         | `v2` / `v3` / `v1` (v1-only = warning)                        |
| `sha256_file`  | `text` NOT NULL                     | Intégrité (64 hex, vérifié au download mobile)                |
| `size_bytes`   | `bigint` NOT NULL                   | Quota 300 Mo (présignature + HEAD, borne `lib/apk-limits.ts`) |
| `r2_key`       | `text` NOT NULL                     | `builds/{maker}/{produit}/{stamp}-{rand}.apk` (confiné)       |
| `whatsnew`     | `text` NULL                         | Notes de version (requises si track, 1000 signes, D4)         |
| `status`       | `text` NOT NULL DEFAULT `'pending'` | `pending` / `approved` / `rejected`                           |
| `created_at`   | `timestamptz` NOT NULL              | Ordre versions + section « Mises à jour » (D6)                |

Index : UNIQUE `(product_id, version_code)`, `(product_id, created_at)`.

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
- RLS deny-all : service seul (`createBuild`), jamais de direct.

## Usage mobile

- Presign : `POST /api/v1/uploads/presign` `{ kind: "apk", productId, contentLength }`
  → `{ url, key, expiresIn }` (PUT direct, 15 min).
- Record : `POST /api/v1/products/[id]/builds`
  `{ r2Key, sha256, sizeBytes, versionCode?, versionName? }` → `{ buildId }` (201).
- Download (D5) : URL GET signée courte, builds approuvés uniquement.
- Install = job mobile (un tap, PackageInstaller) — jamais silencieux sur stock.
