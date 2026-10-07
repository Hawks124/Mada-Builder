# Table `products`

Cœur de l'annuaire : fiches produits, statuts, compteurs dénormalisés.
Statuts : `draft` (invisible) → `pending` (file revue) → `published`
(public) | `rejected` (motif requis). Suppression maker = hard delete
RGPD ; `deleted_at` = retraits admin uniquement.

## Colonnes

| Colonne                     | Type                                        | Notes                                                                                |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                        | `uuid` PK, UUIDv7                           | Jamais dans les URLs (slug)                                                          |
| `slug`                      | `text` UNIQUE NOT NULL                      | URL-safe, minuscules-tirets                                                          |
| `maker_id`                  | `uuid` NOT NULL → `users.id` CASCADE        | Auteur (transfert = listing non réclamé, jamais auto)                                |
| `name`                      | `text` NOT NULL                             | 2–80 (Zod)                                                                           |
| `tagline`                   | `text` NOT NULL                             | 1–220                                                                                |
| `description`               | `text` NOT NULL                             | Markdown, 20–20000 (sanitize import appliqué serveur)                                |
| `category`                  | `text` NOT NULL                             | Slug `config/categories` (principale)                                                |
| `categories`                | `text[]` NOT NULL DEFAULT `{}`              | Toutes choisies, `[0]` = principale, max 3                                           |
| `tags`                      | `text[]` NOT NULL DEFAULT `{}`              | Libres, max 5 × 30 signes                                                            |
| `platforms`                 | `text[]` NOT NULL DEFAULT `{}`              | Ids `config/platforms` (≥ 1)                                                         |
| `links`                     | `jsonb` NOT NULL DEFAULT `{}`               | Map field-id → URL (`ProductLinks`, matrice `config/product-links`, ids validés Zod) |
| `product_type`              | `product_type` NOT NULL DEFAULT `'other'`   | Enum 15 valeurs (mobile→desktop→bot…)                                                |
| `pricing_model`             | `pricing_model` NOT NULL DEFAULT `'free'`   | Enum 6 valeurs (monétisé → privacy requise)                                          |
| `lifecycle`                 | `text` NOT NULL DEFAULT `'live'`            | `dev` \| `beta` \| `live`                                                            |
| `audience`                  | `text` NOT NULL DEFAULT `'all'`             | `kids` → liens privacy/kidsafety requis                                              |
| `license`                   | `text` NULL                                 | max 60 (identifiant SPDX, import détecteur)                                          |
| `has_ads`                   | `boolean` NOT NULL DEFAULT `false`          | Déclaration maker                                                                    |
| `has_in_app_purchase`       | `boolean` NOT NULL DEFAULT `false`          | Déclaration maker                                                                    |
| `shares_data`               | `boolean` NOT NULL DEFAULT `false`          | Déclaration maker (partage tiers)                                                    |
| `is_child_directed`         | `boolean` NOT NULL DEFAULT `false`          | Dérivé (`audience === kids`)                                                         |
| `install_command`           | `text` NULL                                 | max 200, requis si type dev-facing (cli/package/framework/plugin)                    |
| `version`                   | `text` NULL                                 | max 20                                                                               |
| `requirements`              | `text` NULL                                 | max 500 (config requise)                                                             |
| `target_countries`          | `text[]` NOT NULL DEFAULT `{}`              | Marchés servis (filtre « pensé pour »), max 10 × 60                                  |
| `languages_supported`       | `text[]` NOT NULL DEFAULT `{}`              | max 20 × 30                                                                          |
| `icon_url`                  | `text` NULL                                 | Logo final R2 (URL publique racine par bucket)                                       |
| `gallery_orientation`       | `text` NOT NULL DEFAULT `'landscape'`       | Pilotée par le type (`both` = choix : web/game/bot/other)                            |
| `status`                    | `product_status` NOT NULL DEFAULT `'draft'` | Enum 4 statuts                                                                       |
| `rejection_reason`          | `text` NULL                                 | Motif écrit (rejet toujours motivé)                                                  |
| `upvote_count`              | `integer` NOT NULL DEFAULT `0`              | Brut (affichage) — tenu en transaction                                               |
| `score`                     | `real` NOT NULL DEFAULT `0`                 | `w/(h+2)^1.5` (classement) — tenu en transaction/cron                                |
| `ratings_sum`               | `integer` NOT NULL DEFAULT `0`              | Moyenne = sum/count (jamais de flottant stocké)                                      |
| `ratings_count`             | `integer` NOT NULL DEFAULT `0`              |                                                                                      |
| `comments_count`            | `integer` NOT NULL DEFAULT `0`              | Soft-deleted exclus                                                                  |
| `curated`                   | `boolean` NOT NULL DEFAULT `false`          | Veille OSS : hors jeu (classement/featured/votes/avis), catalogue oui                |
| `published_at`              | `timestamptz` NULL                          | Fixé à la publication                                                                |
| `submitted_at`              | `timestamptz` NULL                          | (Re-)soumission en file — base du SLA 24 h (jamais `created_at`)                     |
| `created_at` / `updated_at` | `timestamptz` NOT NULL                      | `updated_at` auto                                                                    |
| `deleted_at`                | `timestamptz` NULL                          | Retraits admin uniquement                                                            |

Index : `maker`, `(maker, updated, id)` keyset, `(status, published)`, `category`, `score`, GIN `search_vector` (tsvector FR pondéré, GENERATED), trigram `name`.

## RLS (`setup.sql`)

- `products_select_public` : `anon, authenticated`, `published` + non supprimé.
- `products_select_own` : `authenticated`, `maker_id = auth.uid()`.
- `products_select_staff` : `authenticated`, rôle admin/modérateur.
- **AUCUNE écriture directe** : submit/édition/revue = services (validation Zod 40+ règles, orientation, reachability, re-revue, R2, idempotence).

## Règles métier miroir (serveur, jamais client)

- Publish : logo + ≥ 1 capture, orientation du type, point d'accès (site/store/registre/démo), matrice liens (kids/monétisé/privacy), URLs joignables, install si dev-facing.
- Nom/liens d'une fiche `published` → retour `pending` (re-revue).
- `curated` : jamais posé par le maker (auto compte curation / toggle admin).
- Slugs uniques, course 23505 → retry (jamais d'erreur brute).

## Realtime

- Non publiée (leaderboard servi + refresh ; vote optimiste + réconciliation).

## Usage mobile

- **Direct (voie première)** : lire `published` (listes, recherche).
  Colonne `curated` → badge « Veille » + vote/avis désactivés avec
  note (commentaires ouverts) ; `isCuration` du profil pour le badge
  compte (clause en bio). Produits d'un maker : `id` via
  `GET /makers/[username]` puis `products?maker_id=eq.{id}`.
- Ne JAMAIS joindre `users` en direct (fuite `email`) : identité maker
  via `GET /makers/[username]`, fiche complète via `GET /products/[slug]`.
- **Écritures** : `POST/PATCH /api/v1/products` uniquement (multipart ou staged présigné).
