# Table `comment_votes`

Votes +1/−1 sur commentaires, toggle (même valeur = retrait), `UNIQUE`
par couple. Score du commentaire = recompte par trigger
(`bridge_comment_votes_write`). **Corollaire d'ingénierie du pont
0055, jamais demandé par la squad** (la demande portait avis +
commentaires) — assumé pour livrer un fil complet.

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
- Pont 0055 : policies identités-only (`insert/update/delete_own`) +
  grants PAR COLONNE ; score du commentaire par TRIGGER.
- **Écriture directe OUVERTE** : la surface exacte fait foi dans
  `docs/mobile-ecritures-directes.md` (migration 0055).

## Règles métier (la base arbitre — garde 0055)

- Commentaire existant, non supprimé, fiche publiée.
- Compte < 1 h refusé par la garde (`account_too_young`).
- Score = `SUM(+1/−1)` exact par recompte, jamais d'incrément.

## Realtime

- Non publiée (optimiste + réconciliation).

## Usage mobile

- **Lecture directe OK** (mes votes : `WHERE user_id = moi`).
- **Écriture en direct (pont 0055)** : INSERT + UPDATE `value` (toggle)
  / DELETE (retrait) PostgREST — `docs/mobile-ecritures-directes.md`
  fait foi.
