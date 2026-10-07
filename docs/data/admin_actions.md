# Table `admin_actions`

Audit trail modération — QUI a fait QUOI à QUI et QUAND. Les compteurs
(« banni 2× ») viennent de COUNT, jamais de colonnes dénormalisées (un
compteur peut dériver, un journal non). Pas de rétroactif : l'historique
commence à la mise en prod.

## Colonnes

| Colonne      | Type                                                     | Notes                                                                                                                                             |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                                        |                                                                                                                                                   |
| `actor_id`   | `uuid` NULL → `users.id` SET NULL                        | NULL = « ancien admin » (l'audit survit à son auteur)                                                                                             |
| `target_id`  | `uuid` NOT NULL (pas de FK — polymorphe user OU produit) | Cohérence dans les services (id vérifié avant log)                                                                                                |
| `action`     | `admin_action` NOT NULL                                  | Enum : `ban/unban/promote/demote`, `appeal_upheld/overturned`, `product_published/rejected/removed/featured`, `review_removed`, `comment_removed` |
| `note`       | `text` NULL                                              | Motif (ban, rejet, retrait…)                                                                                                                      |
| `created_at` | `timestamptz` NOT NULL                                   | Source activité admin                                                                                                                             |

Index : `(target_id, created_at)`.

## RLS (`setup.sql`)

- **Deny-all** : écritures service seules (fail-soft : l'audit ne bloque
  jamais une modération), lectures Drizzle serveur (file admin, activité).

## Règles métier miroir (serveur, jamais client)

- Loggée à chaque décision (ban, rôles, revue, retraits, modération
  feedback) avec acteur + motif.

## Realtime

- Non publiée (activité admin + refresh navigation).

## Usage mobile

- **Jamais direct** : surface admin = web only (hors scope mobile v1).
