# Table `votes`

Boucle centrale (§11) : 1/user/produit, réversible, optimiste côté UI.
**Lecture directe INTERDITE** : les compteurs dénormalisés
(`upvote_count`, `score`) sont la seule source lue. Le poids vit ici
mais ne se devine pas (shadow-weighting).

## Colonnes

| Colonne      | Type                                    | Notes                                                          |
| ------------ | --------------------------------------- | -------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                       |                                                                |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE    |                                                                |
| `product_id` | `uuid` NOT NULL → `products.id` CASCADE |                                                                |
| `weight`     | `integer` NOT NULL DEFAULT `1`          | `1` si compte ≥ 24 h, `0` si < 24 h (affiché, hors classement) |
| `created_at` | `timestamptz` NOT NULL                  |                                                                |

Contraintes : `UNIQUE(user_id, product_id)` ; index `product_id`.

## RLS (`setup.sql`)

- **Deny-all** (aucune policy) : ni lecture ni écriture directe.

## Règles métier miroir (serveur, jamais client)

- Compte < 1 h : refusé (`account_too_young`, dialogue + conditions).
- Compte < 24 h : poids 0 (affiché, `counted: false`).
- Banni : refusé. Veille (`curated`) : refusé. Self-vote : autorisé.
- Rate-limits compte (30/min) + IP (300/min), fail-open ; idempotence
  (`Idempotency-Key`, rejouée à l'identique) ; rescore immédiat +
  milestones (10/50/100/500/1000/5000).
- Compteurs par RECOMPTE (`COUNT`/`SUM`), jamais d'incrément.

## Realtime

- Non publiée (optimiste + réconciliation sur la réponse).

## Usage mobile

- **Ne jamais lire/écrire `votes`** : `POST /products/[id]/vote` →
  `{ voted, upvoteCount, counted }` ; cas `< 1 h` (422 +
  `data.reason`) et `counted === false` → dialogue + lien conditions
  (contrats §9, mêmes textes que le web).
