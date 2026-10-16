# Table `revenue_connections`

Connexions de facturation : 1/produit (`UNIQUE(product_id)`), un
fournisseur par fiche (`stripe` | `revenuecat` | `paddle` | `polar` |
`lemon_squeezy`). Clé **chiffrée** (AES-256-GCM, `lib/revenue-crypto.ts`),
jamais ré-affichée, jamais loggée ; purge à la révocation (snapshots
conservés). Config non-secrète (`project_id`, `store_id`) validée Zod
par provider. `display_mode` : `full` | `badge_only`.

## Colonnes

| Colonne          | Type                                             | Notes                                          |
| ---------------- | ------------------------------------------------ | ---------------------------------------------- |
| `id`             | `uuid` PK, UUIDv7                                |                                                |
| `product_id`     | `uuid` NOT NULL UNIQUE → `products.id` CASCADE   | 1 connexion par fiche ; purge RGPD en cascade  |
| `provider`       | `revenue_provider` NOT NULL                      | 5 valeurs (enum)                               |
| `encrypted_key`  | `text` NOT NULL                                  | `v1.<iv>.<cipher>` ; `""` = purgée (revoked)   |
| `key_hint`       | `text` NULL                                      | 4 derniers caractères (support, jamais la clé) |
| `config`         | `jsonb` NOT NULL DEFAULT `{}`                    | Non-secret, validé par provider                |
| `display_mode`   | `revenue_display_mode` NOT NULL DEFAULT `'full'` | `badge_only` = vérification sans chiffre       |
| `status`         | `revenue_status` NOT NULL DEFAULT `'active'`     | `active` \| `failing` (2 échecs) \| `revoked`  |
| `last_error`     | `text` NULL                                      | Message provider sanitisé (≤300, sans secret)  |
| `failed_count`   | `integer` NOT NULL DEFAULT `0`                   | Échecs consécutifs (reset au succès)           |
| `last_synced_at` | `timestamptz` NULL                               | « vérifié il y a N h »                         |
| `created_at`     | `timestamptz` NOT NULL                           |                                                |

Index : `status`.

## RLS (`setup.sql`)

- **Deny-all** (aucune policy) : sinon n'importe qui lirait les
  connexions via PostgREST. Lectures/écritures Drizzle serveur seul.

## Règles métier miroir (serveur, jamais client)

- Ownership maker (fiche existante) ; probe live avant stockage
  (clé + permissions + config) ; `sk_` Stripe refusé.
- Révocation = statut + purge clé (snapshots gardés).
- **Lecture directe interdite** (clés) ; statuts via endpoints dédiés.

## Realtime

- Non publiée (sync horaire + refresh après mutation).
