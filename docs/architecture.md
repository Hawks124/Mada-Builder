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
| `digests_sent`    | ❌      | ❌                                               | verrou digest (0054), service_role    |
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

## Liens vérifiés (anti-liens-cassés, allège la revue)

`services/url-check.service.ts` (pur, SSRF durci : scheme http(s),
blocklist hôtes, DNS→IP validée à chaque hop, redirects ≤ 5, timeouts
bornés, body jamais stocké/renvoyé) + cache Upstash TTL 24 h (erreurs
transitoires 5 min) + `POST /api/v1/urls/check` (Bearer, 30/min).
Verdicts → politique `block` (malformé, privé, DNS, timeout, connexion)
ou `warn` (404/410, auth, bot, 5xx — submit autorisé + flag revue).
Formulaire : `config/product-links.tsx` (matrice type → champs, source
unique), pastille par champ (`useUrlCheck`, debounce), résumé pré-submit.
Le serveur re-vérifie TOUJOURS (jamais confiance au client). Couvert par
`scripts/verify-url-check.ts` (loopback éphémère, zéro net externe).

## Jobs

**pg_cron (SQL — reconstruit par migration 0054, une base fraîche n'en
dépend plus de `setup.sql`)** : score leaderboard `*/15 * * * *`,
produit du jour `5 0 * * *`, purge brouillons `30 3 1 * *`,
recomptage `download_count` en SQL quotidien `20 3 * * *`
(`recount_download_counts()`). Vérif : `SELECT jobname, schedule,
command, active FROM cron.job ORDER BY jobid`.

**GitHub Actions (routes HTTP `/api/cron/*` en Bearer `CRON_SECRET`,
503 franche sans secret)** :

- `digest-weekly.yml` (lundi 7 h Tana) — digest hebdo ; verrou
  anti-doublon semaine ISO (`digests_sent`, RLS deny-all) et
  `?force=1` pour rattraper un envoi avorté.
- `revenue-sync.yml` (horaire) — sync revenus ; **503 si tout rouge**
  (0 réussite, ≥ 1 échec) pour que le workflow rougisse visiblement.
- `maintenance-weekly.yml` (samedi 03:43 UTC) — jobs sans chemin
  planifié SQL : sweep R2 + abort multipart, purge notifications,
  purge OTP (`cleanupExpiredOtps`), recomptage TS des téléchargements
  et **dead man switch revenus** (connexions actives sans snapshot
  frais < 26 h → alerte Sentry : le job horaire peut mourir en
  silence, la maintenance brise le silence une fois par semaine).

Un 200 menteur est interdit sur `/api/cron/*` : toute étape en échec
renvoie 503 (le workflow rougit).

## Sécurité HTTP (lots C — CSP Report-Only d'abord)

En-têtes globaux via `next.config.ts` (`securityHeaders()` sur
`/:path*`) : `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera/micro/géo refusés). La **CSP est Report-Only**
(`Content-Security-Policy-Report-Only`) : les violations partent dans
`POST /api/csp-report` (rate-limit 60 s/30, IP) → Sentry, sans aucune
rupture fonctionnelle. **Flip en enforce** : après revue des reports
(`unsafe-inline` accepté en style, jamais en script). PRÉVOIR au flip
: les scripts d'amorçage Next sont inline (`self.__next_f.push`) —
`script-src 'self'` nu les bloquerait ; il faudra des **nonces**
(générés à chaque requête dans `proxy.ts`, appliqués par Next aux
scripts inline quand une CSP est en tête) ou `strict-dynamic`,
jamais l'`unsafe-inline` script. Aperçu fiche non publiée : `/preview/*` → `noindex` + `no-store`.

## Anti-abuse des compteurs (lot B)

- `product_downloads` : **écriture PostgREST fermée** (migration 0054,
  policy anon supprimée + REVOKE) — la route serveur est seule
  comptable (option B, contrat mobile mis à jour).
- `product_page_views` : INSERT anon **conservé** (journalisation
  mobile) mais le trigger vues porte un **anti-burst** — au-delà de
  ~60 événements/min/produit, l'événement reste stocké (audit) sans
  incrémenter `view_count` (un flood ne pilote plus le classement).
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
