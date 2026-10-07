# Table `comments`

Commentaires : thread **1 NIVEAU** (reply → parent, jamais de reply de
reply — refusé serveur). Score dénormalisé (up/down). Suppression
auteur/staff = soft. Badge « Maker » = auteur `maker_id` (match serveur,
jamais déclaré par le client).

## Colonnes

| Colonne      | Type                                             | Notes                                                          |
| ------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                                |                                                                |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE             |                                                                |
| `product_id` | `uuid` NOT NULL → `products.id` CASCADE          |                                                                |
| `parent_id`  | `uuid` NULL (pas de FK — auto-référence logique) | NULL = top-level ; non NULL = reply (parent sans parent exigé) |
| `body`       | `text` NOT NULL                                  | 1–1000 signes trimmés                                          |
| `score`      | `integer` NOT NULL DEFAULT `0`                   | up − down (recompte exact en transaction)                      |
| `deleted_at` | `timestamptz` NULL                               | Soft                                                           |
| `created_at` | `timestamptz` NOT NULL                           | Tri : score puis récence (top-level), récence (replies)        |

Index : `(product_id, created_at)`, `parent_id`.

## RLS (`setup.sql`)

- `comments_select_published` : `anon, authenticated`, non supprimés de
  fiches `published`.
- **AUCUNE écriture directe** : nesting, compteurs, modération.

## Règles métier miroir (serveur, jamais client)

- Fiche `published` exigée ; veille : commentaires OUVERTS (avis fermés).
- Parent : existe, même produit, sans parent (sinon 404/VALIDATION).
- Suppression : soft + `comments_count` −1 en transaction.

## Realtime

- Non publiée (thread + refresh après mutation).

## Usage mobile

- **Lecture directe OK** (construire le thread : top-level + replies par
  `parent_id`, tri score→récence / récence).
- **Écriture** : `POST /products/[id]/comments` (`{ body, parentId? }`).
