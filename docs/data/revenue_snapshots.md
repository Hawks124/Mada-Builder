# Table `revenue_snapshots`

Agrégats horaires : MRR + devise + abonnés. **Jamais de PII, jamais de
détail transaction** — c'est la garantie vie privée de la feature.
Idempotence : UNIQUE (`product_id`, `captured_hour`) — un double run
n'écrit qu'une ligne. Courbe 90 j lue ici (dernier point = vérité
affichée). Devise native, **jamais convertie**.

## Colonnes

| Colonne            | Type                                    | Notes                                              |
| ------------------ | --------------------------------------- | -------------------------------------------------- |
| `id`               | `uuid` PK, UUIDv7                       |                                                    |
| `product_id`       | `uuid` NOT NULL → `products.id` CASCADE | Purge RGPD en cascade                              |
| `mrr_cents`        | `integer` NOT NULL                      | Entier ≥ 0 (refusé sinon — jamais de faux chiffre) |
| `currency`         | `text` NOT NULL                         | ISO 4217 native du provider                        |
| `subscriber_count` | `integer` NOT NULL DEFAULT `0`          | Même périmètre que le MRR                          |
| `captured_at`      | `timestamptz` NOT NULL                  | Précis (affichage)                                 |
| `captured_hour`    | `timestamptz` NOT NULL                  | Heure tronquée UTC (idempotence)                   |

Index : (`product_id`, `captured_at`) ; unique (`product_id`, `captured_hour`).

## RLS (`setup.sql`)

- **Deny-all** : lectures Drizzle serveur (fiche, classement, dashboard).

## Règles métier miroir (serveur, jamais client)

- Sync horaire séquentielle (`syncRevenueHourly`) ; montants validés
  avant insert ; classement = `active` + `full` + ≥1 snapshot, groupé
  par devise ; curated exclu.

## Usage mobile

- **Lecture directe interdite**. Agrégats via
  `GET /products/[id]/revenue` (public, cache court).
