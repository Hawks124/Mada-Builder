# Données — index

Référence exhaustive pour l'équipe mobile (hybride) : **un fichier par
table** + buckets + Auth. Chaque fiche décrit le scope, le schéma exact,
les types, les règles métier miroir, les RLS et l'usage mobile
(direct vs API). Relu contre `db/schema` + `db/setup.sql` — en cas de
doute, le schéma fait foi, pas ce doc.

## Règle du jeu (rappel)

- **Lectures** : direct Supabase (PostgREST + Realtime) partout où une
  policy le permet (voir chaque fiche).
- **Écritures** : **uniquement API** (`/api/v1/*`), sauf mention
  explicite. Là où vivent l'anti-abus, la validation, les compteurs
  et les secrets — jamais dupliqués côté client.
- **Conventions globales** : ids UUIDv7 (`text` UUID, triables,
  non énumérables) ; dates `timestamptz` → ISO-8601 ; slug public
  (`username`, produit `slug`), jamais l'id dans les URLs ; soft-delete
  (`deleted_at`) sauf suppression RGPD (hard delete + cascade).

## Tables

| Fiche                                         | Table                 | Lecture directe    | Écriture      |
| --------------------------------------------- | --------------------- | ------------------ | ------------- |
| [users](users.md)                             | `users`               | own uniquement     | API           |
| [products](products.md)                       | `products`            | public/own/staff   | API           |
| [product_screenshots](product_screenshots.md) | `product_screenshots` | public (published) | API (upload)  |
| [votes](votes.md)                             | `votes`               | non (compteurs)    | API           |
| [product_page_views](product_page_views.md)   | `product_page_views`  | non (agrégats)     | API (beacon)  |
| [product_link_clicks](product_link_clicks.md) | `product_link_clicks` | non (agrégats)     | API (beacon)  |
| [featured_products](featured_products.md)     | `featured_products`   | non                | service/admin |
| [reviews](reviews.md)                         | `reviews`             | public (published) | API           |
| [comments](comments.md)                       | `comments`            | public (published) | API           |
| [comment_votes](comment_votes.md)             | `comment_votes`       | own                | API           |
| [notifications](notifications.md)             | `notifications`       | own (+Realtime)    | service       |
| [appeals](appeals.md)                         | `appeals`             | staff              | API           |
| [auth_otp](auth_otp.md)                       | `auth_otp`            | non                | service       |
| [email_logs](email_logs.md)                   | `email_logs`          | non                | service       |
| [idempotency_keys](idempotency_keys.md)       | `idempotency_keys`    | non                | service       |
| [page_views](page_views.md)                   | `page_views`          | non                | service       |
| [admin_actions](admin_actions.md)             | `admin_actions`       | non                | service       |

## Stockage & Auth

| Fiche                 | Sujet                                                           |
| --------------------- | --------------------------------------------------------------- |
| [buckets](buckets.md) | Avatars (Supabase Storage) + médias R2 + pièces d'appel         |
| [auth](auth.md)       | Supabase Auth : OAuth, OTP custom, trigger, JWT, session mobile |
