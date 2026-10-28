# Table `reviews`

Avis : 1/user/produit (`UNIQUE`), note 1–5 + texte REQUIS (10–2000),
modifiable ; réponse maker UNIQUE et officielle (pas de thread) ;
suppression auteur/staff = soft. Moyenne = `ratings_sum`/`ratings_count`
(jamais de flottant stocké). `aggregateRating` SEO seulement si ≥ 1 avis.

## Colonnes

| Colonne                     | Type                                    | Notes                                                      |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `id`                        | `uuid` PK, UUIDv7                       |                                                            |
| `user_id`                   | `uuid` NOT NULL → `users.id` CASCADE    |                                                            |
| `product_id`                | `uuid` NOT NULL → `products.id` CASCADE |                                                            |
| `rating`                    | `smallint` NOT NULL                     | 1–5 (CHECK `reviews_rating_range_check` — la base tranche) |
| `body`                      | `text` NOT NULL                         | 10–2000 signes trimmés                                     |
| `maker_response`            | `text` NULL                             | Une seule, auteur = maker (vérifié service)                |
| `maker_responded_at`        | `timestamptz` NULL                      |                                                            |
| `deleted_at`                | `timestamptz` NULL                      | Soft (contenu = « supprimé », compteurs ajustés)           |
| `created_at` / `updated_at` | `timestamptz` NOT NULL                  | `updated_at` auto                                          |

Contraintes : `UNIQUE(user_id, product_id)` ; index `(product_id, created_at)`.

## RLS (`setup.sql`)

- `reviews_select_published` : `anon, authenticated`, non supprimés de
  fiches `published`.
- Pont 0055 : policies identités-only (`insert/update_own`,
  `user_id = auth.uid()`) + `reviews_select_own` (l'auteur voit ses
  lignes — condition du soft-delete et de la reprise) ; grants PAR
  COLONNE ; DELETE jamais accordé ; compteurs et notifs posés par les
  TRIGGERS `bridge_reviews_*`.
- **Écriture directe OUVERTE** : la surface exacte fait foi dans
  `docs/mobile-ecritures-directes.md` (migration 0055).

## Règles métier (la base arbitre — CHECK + garde 0055)

- Fiche `published` exigée ; veille (`curated`) : avis désactivés
  (commentaires ouverts, eux).
- Renvoi = mise à jour (delta somme par trigger), pas doublon
  (`UNIQUE`).
- Suppression : soft + `ratings_sum`/`ratings_count` par delta
  (GREATEST au décompte — jamais de négatif).
- Réponse maker : unique, auteur = maker (vérifié serveur) — jamais
  en écriture directe (pas de grant).

## Realtime

- Non publiée (liste + refresh après mutation).

## Usage mobile

- **Lecture directe OK** (liste, distribution calculée côté client
  depuis `rating` : moyenne 1 décimale + par-étoile).
- **Écriture en direct (pont 0055)** : INSERT / UPDATE (note, corps,
  soft-delete, reprise) PostgREST — `docs/mobile-ecritures-directes.md`
  fait foi (codes 23514/23505/42501, `DETAIL reason=…`).
