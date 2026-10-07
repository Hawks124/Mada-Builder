# Table `users`

Comptes makers : identité, profil public, rôle, modération. Le slug
public est `username` (immuable) — **jamais l'id dans les URLs**.

## Colonnes

| Colonne                | Type                                  | Notes                                                                                           |
| ---------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                   | `uuid` PK, UUIDv7                     | Généré côté app (`uuid`), triable, non énumérable                                               |
| `username`             | `text` UNIQUE NOT NULL                | Slug public, immuable, liste réservée (admin, api…)                                             |
| `display_name`         | `text` NOT NULL                       | 2–50 signes (Zod)                                                                               |
| `email`                | `text` UNIQUE NOT NULL                | **JAMAIS exposé en public** (voir RLS)                                                          |
| `avatar_url`           | `text` NULL                           | CDN public, `null` = initiales                                                                  |
| `bio`                  | `text` NULL                           | max 160                                                                                         |
| `occupation`           | `text` NOT NULL DEFAULT `'maker'`     | Vocabulaire fermé `config/occupations`                                                          |
| `website_url`          | `text` NULL                           | http(s) uniquement                                                                              |
| `social_links`         | `jsonb` NOT NULL DEFAULT `{}`         | Clés fermées : github, x, facebook, instagram, linkedin, tiktok, whatsapp, website (URLs https) |
| `country`              | `text` NULL                           | max 60                                                                                          |
| `city`                 | `text` NULL                           | max 60                                                                                          |
| `time_zone`            | `text` NULL                           | IANA réel (`Intl…`), NULL = repli UTC                                                           |
| `providers`            | `text[]` NOT NULL DEFAULT `{}`        | Miroir : `["google","github","email"]` (vérité = Supabase identities)                           |
| `role`                 | `user_role` NOT NULL DEFAULT `'user'` | `user` \| `moderateur` \| `admin` (grade admin = SQL only, jamais UI)                           |
| `onboarding_completed` | `boolean` NOT NULL DEFAULT `false`    |                                                                                                 |
| `ban_reason`           | `text` NULL                           | Motif écrit (jamais de ban sans motif)                                                          |
| `banned_at`            | `timestamptz` NULL                    | Non nul = suspendu                                                                              |
| `appeals_count`        | `integer` NOT NULL DEFAULT `0`        | Compteur d'affichage (incrémenté au dépôt)                                                      |
| `digest_opt_out`       | `boolean` NOT NULL DEFAULT `false`    | Opt-out digest hebdo                                                                            |
| `created_at`           | `timestamptz` NOT NULL                | **Sert au poids des votes** (< 1 h refusé, < 24 h poids 0)                                      |
| `updated_at`           | `timestamptz` NOT NULL                | Auto (`$onUpdate`)                                                                              |
| `deleted_at`           | `timestamptz` NULL                    | Soft-delete ; suppression RGPD = hard delete + cascade                                          |

## RLS (`setup.sql`)

- `users_select_own` : `authenticated`, `auth.uid() = id` (lecture ligne).
- `users_update_own` : `authenticated`, own + non banni (update + check).
- **AUCUNE lecture publique** : volontaire — RLS ne filtre pas les
  colonnes, et `email` ne doit jamais fuir. Les profils publics passent
  par `GET /makers/[username]` (allowlist serveur).

## Règles métier miroir (serveur, jamais client)

- 1 compte/personne ; username immuable ; banni = écritures refusées
  (`assertNotBanned`), lectures own conservées (bandeau motif).
- Grades : `user`↔`moderateur` par admin uniquement ; `admin`
  inaltérable via UI.
- Suppression RGPD = hard delete réel (produits, votes, clés en cascade).

## Realtime

- Ligne own publiée (`supabase_realtime`) : watcher ban/déban.
- Pas de temps réel sur les autres users.

## Usage mobile

- **Direct** : lire/écrire SA ligne (`PATCH /me` reste recommandé pour
  la validation : username, occupation, liens, fuseau).
- **Préférences notif** : `digest_opt_out` exposé dans `GET /me`,
  écrit via `PATCH /me/preferences` (`{ digestOptOut }`, même service
  que le switch web — jamais direct pour la validation).
- **Profils tiers** : `GET /makers/[username]` (API, jamais `users`).
- **Écritures sensibles** (rôle, ban, suppression) : jamais direct.
