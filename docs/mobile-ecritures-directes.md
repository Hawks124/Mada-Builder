# Écritures directes — avis, commentaires, votes (migration 0055)

**Doctrine du pont :** la base devient le point d'application des règles.
Pour ces trois domaines, l'app mobile écrit **en direct PostgREST** (sa clé
utilisateur, sans passer par l'API v1) ; le web continue par son service TS.
QUEL que soit l'écrivain, les effets de bord (compteurs, score,
notifications) sont posés **par la base** (triggers `SECURITY DEFINER`) —
le service web n'écrit plus jamais ces effets, donc pas de double-compte
possible. Un seul arbitre : la base. Aucune architecture nouvelle côté
mobile : du PostgREST avec l'access token habituel, rien d'autre.

Migration de référence : `db/migrations/0055_mobile_direct_writes_bridge.sql`
(miroir environnement neuf : `db/setup.sql` §3d-quinquies). La preuve
d'exécution : `scripts/verify-mobile-direct.ts` (37 assertions en
transaction annulée — `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-mobile-direct.ts`).

## 1. La surface exacte (grants par colonne)

L'`id` est **obligatoire** (uuid v7 généré côté client — la table n'a pas
de défaut SQL, même convention que le web) :

| table           | INSERT (colonnes permises)                 | UPDATE (colonnes permises)             | DELETE                |
| --------------- | ------------------------------------------ | -------------------------------------- | --------------------- |
| `reviews`       | `id, user_id, product_id, rating, body`    | `rating, body, deleted_at, updated_at` | **jamais**            |
| `comments`      | `id, user_id, product_id, parent_id, body` | `body, deleted_at, updated_at`         | **jamais**            |
| `comment_votes` | `id, user_id, comment_id, value`           | `value`                                | oui (retrait du vote) |

- `user_id` = toujours **soi** (RLS `user_id = auth.uid()`) ; ne jamais
  l'usurper — l'INSERT d'autrui est refusé (42501), l'UPDATE d'autrui est
  filtré à 0 ligne (silencieux).
- `created_at`, `maker_response`, `maker_responded_at` : jamais en
  écriture (pas de grant).
- Suppression = **soft** : `UPDATE … SET deleted_at = now()` ; reprise =
  `SET deleted_at = null` (l'auteur voit toujours sa propre ligne
  supprimée — voir §3). Un `DELETE` direct lève 42501 (grant absent).

## 2. Les règles que la base applique (et le code d'erreur à mapper)

| règle                             | détection | message de la base                 |
| --------------------------------- | --------- | ---------------------------------- |
| note 1–5                          | `23514`   | CHECK `reviews_rating_range_check` |
| avis : corps 10–2000 (trim)       | `23514`   | CHECK `reviews_body_len_check`     |
| commentaire : corps 1–1000 (trim) | `23514`   | CHECK `comments_body_len_check`    |
| 1 avis / user / produit           | `23505`   | unique `reviews_user_product_uidx` |
| 1 vote / user / commentaire       | `23505`   | unique sur `comment_votes`         |
| écriture refusée (RLS/grant)      | `42501`   | voir §1                            |

La **garde** (trigger) refuse avec un message FR lisible et un `DETAIL
reason=…` exploitable côté Dart :

| `reason`                                                   | situation                                                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account_not_found` / `account_deleted` / `account_banned` | compte introuvable / supprimé / suspendu                                                                                                                                |
| `account_too_young`                                        | compte âgé de moins d'une heure                                                                                                                                         |
| `flood`                                                    | filet global : 20 écritures / 60 s **toutes opérations de la table confondues** — ne pas s'y fier pour le per-op contractuel (Upstash ~20/60 s reste la règle côté app) |
| `product_not_published`                                    | fiche draft/pending/rejected (avis comme commentaires)                                                                                                                  |
| `curated`                                                  | produit en veille : avis refusés, **commentaires ouverts**                                                                                                              |
| `parent_not_found`                                         | parent introuvable, cross-produit ou supprimé                                                                                                                           |
| `reply_too_deep`                                           | réponse de réponse (un seul niveau)                                                                                                                                     |

PostgREST renvoie ces exceptions avec `message` (texte FR) et `details`
(`reason=…`) — mapper sur `reason`, pas sur le texte.

## 3. Effets de bord posés par la base (ne plus jamais les écrire côté client)

- `products.ratings_sum` / `ratings_count` / `comments_count` : deltas
  exacts (avec GREATEST au décompte, sémantique de l'ancien TS).
- `comments.score` : recompte `sum(+1/-1)` à chaque écriture de vote.
- `notifications` : `review_received` (à la création de l'avis, jamais à
  l'édition), `comment_received` (maker), `comment_replied` (auteur du
  parent — jamais soi-même, jamais le maker en double). Titres FR
  pré-rendus identiques à ceux du web.
- **Écrire `notifications` ou `products` en direct est fermé** (REVOKE — 42501) : notifs par triggers, fiches par le service web seulement.

## 4. Note d'ingénierie (si vous ajoutez un jour une table au pont)

PostgreSQL applique **aussi** les policies `SELECT` comme `WITH CHECK`
sur la nouvelle ligne d'un `UPDATE`. Une table du pont doit donc avoir,
outre sa policy SELECT publique, une policy `SELECT own-row`
(`user_id = auth.uid()`) : sans elle, le soft-delete même de l'auteur
serait refusé (la ligne modifiée devient invisible-publique → 42501).
C'est aussi ce qui rend la reprise possible (l'auteur relit sa ligne
supprimée avant de la restaurer).

## 5. Ce qui reste en API v1 (pas de pont)

Écriture de la fiche produit (service web), votes-produits (shadow
weighting), modération, revenus vérifiés, uploads presign, profile et
session — inchangés (§2 et §3 de `mobile-contrats.md`). Les lectures
directes publiques restent celles du §1-bis de `mobile-contrats.md`.
