# Architecture — où vit quoi

> Convention générale : **pages fines → services métier → db/lib**.
> Jamais de SQL ni de secrets dans `app/` ou `components/`.

## Cycle d'une requête web

```
Navigateur
  → proxy.ts ................. session ? rôle ? (JWT app_metadata, 0 requête DB)
  → layout server ............ double-check session/rôle (défense en profondeur)
  → page server .............. lit via services/*.service.ts
  → services ................. Drizzle + Zod + règles (jamais de session ici)
  → lib/supabase ............. clients + storage (clés via env uniquement)
  → db/ ...................... schéma + client singleton (DATABASE_URL seule)
```

## Cycle d'un appel mobile (API v1)

```
Flutter (session Supabase native, OAuth)
  → app/api/v1/* ............. Bearer vérifié (getUser serveur), enveloppe {ok, code}
  → services ................. LES MÊMES (aucune logique dupliquée)
```

## Règles de placement

| Besoin                  | Où                                                     | Jamais là                                 |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Requête SQL / Drizzle   | `services/*.service.ts`, `db/`                         | `app/`, `components/`                     |
| secret / service_role   | `services/`, routes API, scripts                       | `components/`, client, logs               |
| Validation métier (Zod) | co-localisée service, exportée                         | dupliquée client/serveur                  |
| Session web (`getUser`) | proxy, layouts, Server Actions                         | services (reçoivent `viewerId`/`isStaff`) |
| Session mobile (Bearer) | `lib/api/auth.ts` (`requireApiUser`)                   | services (reçoivent l'id)                 |
| Cache/invalidation      | service expose `username` → l'appelant `revalidateTag` | `select *` sur users (allowlist!)         |
| Constantes métier       | `config/*` (occupations…)                              | en dur dans les composants                |

## Matrice RLS (défense passive — l'enforcement réel vit dans les services)

| Table             | anon    | authenticated                                    | Notes                                 |
| ----------------- | ------- | ------------------------------------------------ | ------------------------------------- |
| `users`           | ❌      | soi uniquement (+ garde `banned_at` en écriture) | lectures larges = service_role        |
| `auth_otp`        | ❌      | ❌                                               | service_role uniquement               |
| `appeals`         | ❌      | staff (`appeals_select_staff`, realtime admin)   | écritures = service_role              |
| `admin_actions`   | ❌      | ❌                                               | audit, service_role uniquement        |
| `page_views`      | ❌      | ❌                                               | anonyme par schéma (pas de `user_id`) |
| Storage `avatars` | lecture | CRUD own-path (non banni)                        | écritures API = service_role          |
| Storage `appeals` | ❌      | insert own-path                                  | lecture = URLs signées service        |

## Temps réel

- `users` → le client suit **sa propre ligne** (`banned_at` = écran suspendu, web + mobile).
- `appeals` → `appeals:inserts` + RLS staff (file admin, zéro polling).

## Emails (Resend, best-effort, FR)

6 templates (`lib/email-templates/`) : marque partagée (`brand.ts`, PNG
clair/sombre), footer juridique (`footer.ts`), footer modération incitatif
(ban/déban/décision). Rendus couverts par `scripts/verify-email-templates.ts`.
`appeal-notify` = interne staff (pas de footer légal).

## Jobs (pg_cron + GitHub Actions si besoin)

- Score leaderboard (15 min), produit du jour (quotidien), sync revenus (horaire) : **pg_cron** (DB-local, pas de secrets en CI).
- `cleanupExpiredOtps()` : cron V1.5.
- Votes/commentaires : triggers/transactions, jamais de cron.

## Groupes de routes

- `(site)` — public, indexable (SEO).
- `(dashboard)` — shell client + wrapper server (session).
- `(admin)` — idem + rôle, noindex.
- `(auth)` — shell nu, `/signin` noindex.
- `(onboarding)` — `/bienvenue`, shell nu.
- `api/v1` — mobile (Bearer, enveloppe JSON, 404 JSON).

## Tests

- `npx tsx scripts/verify-*.ts` — backend réel, nettoyage après soi.
- `npx tsc --noEmit` + `npx eslint` + `npm run build` avant chaque lot.
