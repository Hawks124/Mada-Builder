# Table `featured_products`

Produit du jour (§11) : UNE ligne par date calendaire (UTC). Rotation à
volume variable (normal/peu/très peu) + override admin (`pinned`).
Jamais vide par construction du service (tiers + état honnête côté UI).

## Colonnes

| Colonne       | Type                                    | Notes                                                                |
| ------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `id`          | `uuid` PK, UUIDv7                       |                                                                      |
| `product_id`  | `uuid` NOT NULL → `products.id` CASCADE | Jamais de veille (`curated` refusé à l'override comme à la rotation) |
| `featured_on` | `date` NOT NULL UNIQUE                  | Date calendaire UTC                                                  |
| `pinned`      | `boolean` NOT NULL DEFAULT `false`      | Override admin (respecté par le job)                                 |
| `created_at`  | `timestamptz` NOT NULL                  |                                                                      |

Index : `product_id`.

## RLS (`setup.sql`)

- **Deny-all** (aucune policy) : sinon n'importe qui épinglerait sa
  fiche via PostgREST. Lectures Drizzle serveur, écriture job/admin.

## Règles métier miroir (serveur, jamais client)

- Paliers : top (#1 hier, non-featuré 30 j) → rotation (jamais-featuré,
  re-feature ≥ 7 j) → latest. Override = slug résolu (jamais d'uuid
  tapé), `null` = lever.

## Realtime

- Non publiée (rotation quotidienne + refresh).

## Usage mobile

- **Lecture** : via les endpoints existants (pas de lecture directe).
- **Écriture** : jamais (admin web uniquement).
