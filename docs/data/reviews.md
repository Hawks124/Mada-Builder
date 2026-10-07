# Table `reviews`

Avis : 1/user/produit (`UNIQUE`), note 1–5 + texte REQUIS (10–2000),
modifiable ; réponse maker UNIQUE et officielle (pas de thread) ;
suppression auteur/staff = soft. Moyenne = `ratings_sum`/`ratings_count`
(jamais de flottant stocké). `aggregateRating` SEO seulement si ≥ 1 avis.

## Colonnes

| Colonne                     | Type                                    | Notes                                            |
| --------------------------- | --------------------------------------- | ------------------------------------------------ |
| `id`                        | `uuid` PK, UUIDv7                       |                                                  |
| `user_id`                   | `uuid` NOT NULL → `users.id` CASCADE    |                                                  |
| `product_id`                | `uuid` NOT NULL → `products.id` CASCADE |                                                  |
| `rating`                    | `smallint` NOT NULL                     | 1–5 (Zod, pas de CHECK — le service tranche)     |
| `body`                      | `text` NOT NULL                         | 10–2000 signes trimmés                           |
| `maker_response`            | `text` NULL                             | Une seule, auteur = maker (vérifié service)      |
| `maker_responded_at`        | `timestamptz` NULL                      |                                                  |
| `deleted_at`                | `timestamptz` NULL                      | Soft (contenu = « supprimé », compteurs ajustés) |
| `created_at` / `updated_at` | `timestamptz` NOT NULL                  | `updated_at` auto                                |

Contraintes : `UNIQUE(user_id, product_id)` ; index `(product_id, created_at)`.

## RLS (`setup.sql`)

- `reviews_select_published` : `anon, authenticated`, non supprimés de
  fiches `published`.
- **AUCUNE écriture directe** : unicité, compteurs, ownership réponse.

## Règles métier miroir (serveur, jamais client)

- Fiche `published` exigée ; veille (`curated`) : avis désactivés
  (commentaires ouverts, eux).
- Renvoi = mise à jour (+delta somme), pas doublon.
- Suppression : soft + `ratings_sum`/`ratings_count` ajustés en
  transaction (jamais d'incrément isolé).

## Realtime

- Non publiée (liste + refresh après mutation).

## Usage mobile

- **Lecture directe OK** (liste, distribution calculée côté client
  depuis `rating` : moyenne 1 décimale + par-étoile).
- **Écriture** : `POST /products/[id]/reviews` uniquement.
