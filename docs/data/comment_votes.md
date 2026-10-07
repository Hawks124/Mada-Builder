# Table `comment_votes`

Votes +1/−1 sur commentaires, toggle (même valeur = retrait), `UNIQUE`
par couple. Score du commentaire = recompte exact en transaction.

## Colonnes

| Colonne      | Type                                    | Notes               |
| ------------ | --------------------------------------- | ------------------- |
| `id`         | `uuid` PK, UUIDv7                       |                     |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE    |                     |
| `comment_id` | `uuid` NOT NULL → `comments.id` CASCADE |                     |
| `value`      | `comment_vote_value` NOT NULL           | Enum `up` \| `down` |
| `created_at` | `timestamptz` NOT NULL                  |                     |

Contrainte : `UNIQUE(user_id, comment_id)`.

## RLS (`setup.sql`)

- `comment_votes_select_own` : `authenticated`, `auth.uid() = user_id`
  (afficher « mes votes » en direct).
- **AUCUNE écriture directe** : toggle + recompte en transaction.

## Règles métier miroir (serveur, jamais client)

- Commentaire existant, non supprimé, fiche publiée.
- Compte < 1 h refusé (même règle que les votes).
- Score = `SUM(+1/−1)` exact, jamais d'incrément.

## Realtime

- Non publiée (optimiste + réconciliation).

## Usage mobile

- **Lecture directe OK** (mes votes : `WHERE user_id = moi`).
- **Écriture** : `POST /comments/[id]/vote` (`{ value }`, idempotent
  par clé) → `{ voted, score }`.
