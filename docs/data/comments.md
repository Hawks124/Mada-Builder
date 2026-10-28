# Table `comments`

Commentaires : thread **1 NIVEAU** (reply → parent, jamais de reply de
reply — refusé par la garde 0055). Score dénormalisé (up/down).
Suppression auteur/staff = soft. Badge « Maker » = auteur `maker_id`
(match serveur, jamais déclaré par le client).

## Colonnes

| Colonne      | Type                                             | Notes                                                          |
| ------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                                |                                                                |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE             |                                                                |
| `product_id` | `uuid` NOT NULL → `products.id` CASCADE          |                                                                |
| `parent_id`  | `uuid` NULL (pas de FK — auto-référence logique) | NULL = top-level ; non NULL = reply (parent sans parent exigé) |
| `body`       | `text` NOT NULL                                  | 1–1000 signes trimmés                                          |
| `score`      | `integer` NOT NULL DEFAULT `0`                   | up − down (recompte par trigger `bridge_comment_votes_write`)  |
| `deleted_at` | `timestamptz` NULL                               | Soft                                                           |
| `created_at` | `timestamptz` NOT NULL                           | Tri : score puis récence (top-level), récence (replies)        |

Index : `(product_id, created_at)`, `parent_id`.

## RLS (`setup.sql`)

- `comments_select_published` : `anon, authenticated`, non supprimés de
  fiches `published`.
- Pont 0055 : policies identités-only (`insert/update_own`,
  `user_id = auth.uid()`) + `comments_select_own` (l'auteur voit ses
  lignes — condition du soft-delete et de la reprise) ; grants PAR
  COLONNE ; DELETE jamais accordé ; `comments_count` et notifs posés
  par les TRIGGERS `bridge_comments_*`.
- **Écriture directe OUVERTE** : la surface exacte fait foi dans
  `docs/mobile-ecritures-directes.md` (migration 0055).

## Règles métier (la base arbitre — CHECK + garde 0055)

- Fiche `published` exigée ; veille : commentaires OUVERTS (avis
  fermés, eux).
- Parent : existe, même produit, sans parent (sinon `parent_not_found`
  par la garde).
- Suppression : soft + `comments_count` −1 par delta (GREATEST au
  décompte — jamais de négatif).

## Realtime

- Non publiée (thread + refresh après mutation).

## Usage mobile

- **Lecture directe OK** (construire le thread : top-level + replies par
  `parent_id`, tri score→récence / récence).
- **Écriture en direct (pont 0055)** : INSERT / UPDATE (corps,
  soft-delete, reprise) PostgREST — `docs/mobile-ecritures-directes.md`
  fait foi (codes 23514/23505/42501, `DETAIL reason=…`).
