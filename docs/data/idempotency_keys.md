# Table `idempotency_keys`

Clés d'idempotence API (`Idempotency-Key`) : un retry mobile sur réseau
fluctuant rejoue la PREMIÈRE réponse au lieu de ré-exécuter (jamais de
produit dupliqué ni de double-toggle). Ligne `status NULL` = requête en
vol (concurrence → 409 franc, le client réessaie puis reçoit le replay).

## Colonnes

| Colonne      | Type                                 | Notes                                                       |
| ------------ | ------------------------------------ | ----------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                    |                                                             |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE | Portée par user (même clé, users différents = indépendants) |
| `key`        | `text` NOT NULL                      | 1–64 : lettres, chiffres, `-_` (validé, sinon 422)          |
| `status`     | `integer` NULL                       | Statut HTTP rejoué (NULL = en vol)                          |
| `body`       | `jsonb` NULL                         | Réponse rejouée (`Record` ou null)                          |
| `created_at` | `timestamptz` NOT NULL               | TTL 24 h, purge paresseuse (à l'accès, jamais de cron)      |

Contrainte : `UNIQUE(user_id, key)` (réserve atomique) ; index `created_at`.

## RLS (`setup.sql`)

- **Deny-all** : `withIdempotency` seul (réserve/replay/purge).

## Règles métier miroir (serveur, jamais client)

- **Une clé = une intention** (nouveau vote ≠ nouveau toggle : changer
  de clé pour revoter) ; même clé = réponse rejouée (`replayed: true`).
- Clé absente = exécution directe (pas d'erreur) ; clé malformée = 422.
- Panne DB : fail-open (exécution directe, log Sentry).

## Realtime

- Non publiée.

## Usage mobile

- **Jamais direct** : header `Idempotency-Key` sur `POST /products`,
  `POST /[id]/vote`, `POST /comments/[id]/vote` (générer par tentative,
  ex. UUID). 409 = attendre puis renvoyer la même clé.
