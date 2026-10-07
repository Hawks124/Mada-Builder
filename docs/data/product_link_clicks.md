# Table `product_link_clicks`

Clics sortants — anonymes aussi (`product_id` + field-id matrice, rien
d'autre). Le chiffre qui compte pour les makers (dashboard, CTR).

## Colonnes

| Colonne      | Type                                    | Notes                                                          |
| ------------ | --------------------------------------- | -------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                       |                                                                |
| `product_id` | `uuid` NOT NULL → `products.id` CASCADE |                                                                |
| `target`     | `text` NOT NULL                         | Field-id matrice (`website`, `playstore`…), borné côté service |
| `created_at` | `timestamptz` NOT NULL                  | Fenêtres 7 j / totaux                                          |

Index : `(product_id, created_at)`.

## RLS (`setup.sql`)

- **Deny-all** : écriture service seule (beacon best-effort, jamais
  bloquant), lectures Drizzle serveur (batch engagement).

## Règles métier miroir (serveur, jamais client)

- Fiche publiée exigée ; `target` borné à la matrice (inconnu ignoré).
- Best-effort silencieux.

## Realtime

- Non publiée.

## Usage mobile

- **Écriture** : `POST /api/v1/beacon/click` `{ productId, target }`
  (toujours 200, même invalide — jamais bloquant).
- **Lecture** : agrégats via `GET /me/products` (tableau de bord),
  jamais la table.
