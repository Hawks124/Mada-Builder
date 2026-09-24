# Contrats mobile — API v1 & données (équipe Flutter)

> Le Next.js est le **seul backend** (toutes les clés y vivent). Flutter est
> un client mince : session native Supabase (OAuth only MVP) + HTTP vers
> `/api/v1/*`. **Aucune logique métier côté mobile** — en cas de doute, le
> serveur tranche (mêmes services que le web).
>
> Base URL : `{origin}/api/v1`. Versionnée dès le jour 1 (`/v1`).

## 1. Session (packages natifs, jamais custom)

- **Google / GitHub via `supabase_flutter`** (même projet Supabase que le web
  → même trigger → même ligne `public.users`). Email/OTP : **web only**,
  aucun endpoint mobile.
- Chaque appel API : `Authorization: Bearer <access_token>` (refresh géré
  par le SDK ; 401 `Session invalide ou expirée` → refresh → échec = login).
- **Après chaque login OAuth et chaque liaison** : `POST /api/v1/auth/providers/sync`
  (le trigger ne pose que le *premier* provider — sans ce sync, `providers[]`
  se périme ; idempotent, best-effort).
- GitHub sans email → ligne en `@placeholder.local` : implémenter la gate
  onboarding (§5) qui exige un vrai email (même règle que `/bienvenue`).

## 2. Enveloppe & erreurs (le `switch` Dart s'appuie sur `code`)

```json
// Succès
{ "ok": true, "data": { ... } }
// Échec
{ "ok": false, "code": "VALIDATION", "message": "Champs invalides." }
```

| `code` | HTTP | Sens mobile |
|---|---|---|
| `UNAUTHORIZED` | 401 | login (ou compte supprimé) |
| `BANNED` | 403 | écran suspendu (`data.banReason`) |
| `FORBIDDEN` | 403 | action interdite (autrui, garde) |
| `NOT_FOUND` | 404 | inconnu (profil, compte) |
| `VALIDATION` | 422 | champs invalides (réafficher, `message` FR) |
| `CONFLICT` | 409 | conflit (email pris…) |
| `FILE_REJECTED` | 422 | fichier refusé (poids, format, dimensions) |
| `RATE_LIMITED` | 429 | retry dans une minute |
| `INVALID_BODY` | 400 | JSON/multipart malformé |
| `METHOD_NOT_ALLOWED` | 405 | mauvaise méthode (header `Allow` = contrat ; jamais de HTML) |
| `INTERNAL` | 500 / 503 | 500 = retry plus tard (détail jamais exposé) ; **503 = incident Auth/réseau → retry en gardant la session, jamais de logout** |

- Route inconnue sous `/api/v1/*` → 404 JSON (jamais de HTML). `OPTIONS` accepté partout (preflight).
- 401 `Session invalide ou expirée` → refresh SDK → échec = écran login (jamais de logout sur 503).
- `username` et `email` immuables (422 même forgés) ; `role` jamais exposé en écriture.
- Dates toujours ISO (`"2026-09-24T…"`), `null` explicites.

## 3. Endpoints

| Méthode & chemin | Auth | Corps | Réponse `data` |
|---|---|---|---|
| `GET /me` | Bearer (banni OK) | — | profil privé complet (miroir dashboard : tout, y compris `email`, `bannedAt`, `banReason`) |
| `PATCH /me` | Bearer | JSON partiel (clés inconnues ignorées) | profil frais complet |
| `POST /me/avatar` | Bearer | multipart `avatar` | `{ avatarUrl }` |
| `DELETE /me` | Bearer (banni OK) | `{"confirm":true}` exigé | `{ deleted: true }` → purger les tokens côté client |
| `GET /onboarding` | Bearer (banni OK) | — | `{ done, missing, form }` (`form.email` vide si placeholder) |
| `POST /onboarding` | Bearer (banni OK) | `{ displayName?, email?, occupation? }` | `{ username, done, missing }` (`done` = aller au home) |
| `POST /auth/providers/sync` | Bearer | — | `{ providers: ["google", …] }` (trio connu seul) |
| `GET /appeals/mine` | Bearer (banni OK) | — | `{ eligible, message }` (toujours 200 ; griser le bouton + afficher `message`) |
| `POST /appeals` | Bearer (banni OK) | multipart `explanation` + `evidence` ×0–3 | `{ appealId, seq }` + message `Appel nºX envoyé.` |
| `GET /makers/[username]` | non | — | profil public (jamais email/motif ; `bannedAt` = badge Suspendu) ; 404 si inconnu |
| `GET /meta` | non | — | référentiel : `occupations` (id/label/description), `defaultOccupation`, `providers`, `limits` — **lire, jamais hardcoder** |

Règles produit à réimplémenter à l'identique : nom ≥ 2 caractères ;
occupation = `GET /meta` (vocabulaire fermé servi par le backend — jamais
hardcodé côté Dart) ;
appel = explication 10–2000 + pièces PNG/JPG/WebP/PDF ≤ 10 Mo, pending unique,
24 h entre dépôts ; suppression = action irréversible (confirmation forte côté UI).

## 4. Fichiers — compresser avant d'envoyer

Le serveur accepte 10 Mo (magic-bytes, sharp 512px WebP pour les avatars —
limites exactes dans `GET /meta`),
mais l'hébergement serverless tronque vers ~4,5 Mo **avant** notre code.
**Compresser côté Flutter (< 2 Mo) systématiquement** : le serveur reste le
garde-fou (self-hosted, retries), pas le chemin nominal. SVG/GIF/exécutables
refusés partout.

## 5. Temps réel (realtime, clé anon — lecture de sa propre ligne uniquement)

- `users:id=eq.<uid>` → `banned_at` non nul = écran suspendu + purge session.
  (La RLS `users_select_own` l'autorise ; tout le reste passe par l'API.)
- `appeals` : staff only — le mobile n'y touche pas (`GET /appeals/mine` suffit).

## 6. Table `users` — sens des colonnes (lecture `/me`)

| Colonne | Sens mobile |
|---|---|
| `id` | UUIDv7, jamais affiché (support : tronqué + copie côté admin web) |
| `username` | slug public, **immuable** (URLs `/makers/`) |
| `displayName`, `bio`, `occupation`, `websiteUrl`, `socialLinks`, `country`, `city` | éditables (`PATCH /me`) |
| `email` | contact, immuable V1 (sauf placeholder → onboarding) |
| `avatarUrl` | CDN public, `null` = initiales (jamais de visage d'emprunt) |
| `providers` | `["google","github","email"]` — source de vérité, sync §1 |
| `role` | lecture seule (`user` — admin = web only) |
| `bannedAt`, `banReason` | écran suspendu ; `banReason` = motif à afficher |
| `appealsCount` | compteur d'appels déposés |
| `onboardingCompleted` | flag + `GET /onboarding` (`done = flag && !dirty`) |

## 7. Rate-limits (Upstash, fail-open)

Lectures ~120/min, écritures ~20/min, fichiers ~10/min, sync ~30/min,
suppression 5/min. `429` = attendre une minute (pas de retry immédiat en
boucle). Les verrous métier (appel pending, 24 h) s'ajoutent par-dessus.

## 8. Hors scope mobile v1 (web only, stated)

Admin (`/admin/*`), email/OTP, liaison provider sans `sync`, digest email.
Les endpoints products/votes/listings arriveront avec le milestone products
(même pattern : portes minces sur services existants).
