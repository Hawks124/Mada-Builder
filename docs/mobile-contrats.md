# Contrats mobile — API v1 & données (équipe Flutter)

> Le Next.js est le **seul backend** (toutes les clés y vivent). Flutter est
> un client mince : session native Supabase (OAuth only MVP) + HTTP vers
> `/api/v1/*`. **Aucune logique métier côté mobile** — en cas de doute, le
> serveur tranche (mêmes services que le web).
>
> Base URL : `{origin}/api/v1`. Versionnée dès le jour 1 (`/v1`).

## 1. Session (packages natifs, jamais custom)

- **Google / GitHub via `supabase_flutter`** (même projet Supabase que le web
  → même trigger → même ligne `public.users`).
- **Email OTP custom** (pas le magiclink Supabase) : `POST
/api/v1/auth/otp/request` `{email}` → `{ok:true}` (throttle 60 s/email,
  anti-énumération : réponse identique que l'email existe ou non), puis
  l'utilisateur tape le code à 6 chiffres → `POST
/api/v1/auth/otp/verify` `{email, code}` → `{access_token,
refresh_token, expires_in, user}` → stocker via
  `supabase.auth.setSession()` (ensuite : natif complet — PostgREST,
  Realtime, refresh auto). Erreurs TOUJOURS génériques (« Code incorrect
  ou expiré. », TTL 10 min, 5 tentatives puis burn, single-use).
  Détail : `docs/data/auth.md`.
- Chaque appel API : `Authorization: Bearer <access_token>` (refresh géré
  par le SDK ; 401 `Session invalide ou expirée` → refresh → échec = login).
- **Après chaque login OAuth et chaque liaison** : `POST /api/v1/auth/providers/sync`
  (le trigger ne pose que le _premier_ provider — sans ce sync, `providers[]`
  se périme ; idempotent, best-effort).
- GitHub sans email → ligne en `@placeholder.local` : implémenter la gate
  onboarding (§5) qui exige un vrai email (même règle que `/bienvenue`).

## 1-bis. Lecture directe (voie première, zéro wrapper)

Les lectures publiques passent en **direct PostgREST** (RLS laissent
passer, voir `docs/data/*`) — les endpoints `GET` ci-dessous restent
disponibles en version optimisée (cache edge partagé, jointures maker
incluses, enveloppe stable). Règles directes :

- `products` : `status=eq.published` + `deleted_at=is.null` (toujours) ;
  tri `published_at.desc` / `score.desc` ; colonne `curated` → badge
  « Veille » + vote/avis désactivés avec note (commentaires ouverts).
- `product_screenshots` / `reviews` / `comments` : filtrer `product_id`
  (RLS = published uniquement) ; `comment_votes` : `user_id=eq.moi`.
- **INTERDIT en direct** : joindre `users` (fuite `email`) — identité
  maker via `GET /makers/[username]` (rend `isCuration` + clause en bio).
- Produits d'un maker : `id` depuis `GET /makers/[username]` puis
  `products?maker_id=eq.{id}&status=eq.published&order=published_at.desc`.
- `votes`, compteurs, `users`, écritures : voir §2 et docs data
  (jamais en direct).

## 2. Enveloppe & erreurs (le `switch` Dart s'appuie sur `code`)

```json
// Succès
{ "ok": true, "data": { ... } }
// Échec
{ "ok": false, "code": "VALIDATION", "message": "Champs invalides." }
```

| `code`               | HTTP      | Sens mobile                                                                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHORIZED`       | 401       | login (ou compte supprimé)                                                                                                    |
| `BANNED`             | 403       | écran suspendu (`data.banReason`)                                                                                             |
| `FORBIDDEN`          | 403       | action interdite (autrui, garde)                                                                                              |
| `NOT_FOUND`          | 404       | inconnu (profil, compte)                                                                                                      |
| `VALIDATION`         | 422       | champs invalides (réafficher, `message` FR)                                                                                   |
| `CONFLICT`           | 409       | conflit (email pris…)                                                                                                         |
| `FILE_REJECTED`      | 422       | fichier refusé (poids, format, dimensions)                                                                                    |
| `RATE_LIMITED`       | 429       | retry dans une minute                                                                                                         |
| `INVALID_BODY`       | 400       | JSON/multipart malformé                                                                                                       |
| `METHOD_NOT_ALLOWED` | 405       | mauvaise méthode (header `Allow` = contrat ; jamais de HTML)                                                                  |
| `INTERNAL`           | 500 / 503 | 500 = retry plus tard (détail jamais exposé) ; **503 = incident Auth/réseau → retry en gardant la session, jamais de logout** |

- Route inconnue sous `/api/v1/*` → 404 JSON (jamais de HTML). `OPTIONS` accepté partout (preflight).
- 401 `Session invalide ou expirée` → refresh SDK → échec = écran login (jamais de logout sur 503).
- `username` et `email` immuables (422 même forgés) ; `role` jamais exposé en écriture.
- Dates toujours ISO (`"2026-09-24T…"`), `null` explicites.

## 3. Endpoints

| Méthode & chemin               | Auth              | Corps                                                                                                                                                     | Réponse `data`                                                                                                                                                                                                                                             |
| ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /me`                      | Bearer (banni OK) | —                                                                                                                                                         | profil privé complet (miroir dashboard : tout, y compris `email`, `bannedAt`, `banReason`, `digestOptOut`)                                                                                                                                                 |
| `PATCH /me`                    | Bearer            | JSON partiel (clés inconnues ignorées ; `timeZone` = IANA réel, jamais bloquant)                                                                          | profil frais complet                                                                                                                                                                                                                                       |
| `PATCH /me/preferences`        | Bearer            | `{ digestOptOut: boolean }` (préférences notif, extensible ; même service que le switch web)                                                              | `{ digestOptOut }` frais (pas de refetch)                                                                                                                                                                                                                  |
| `POST /me/avatar`              | Bearer            | multipart `avatar`                                                                                                                                        | `{ avatarUrl }`                                                                                                                                                                                                                                            |
| `DELETE /me`                   | Bearer (banni OK) | `{"confirm":true}` exigé                                                                                                                                  | `{ deleted: true }` → purger les tokens côté client                                                                                                                                                                                                        |
| `GET /onboarding`              | Bearer (banni OK) | —                                                                                                                                                         | `{ done, missing, form }` (`form.email` vide si placeholder)                                                                                                                                                                                               |
| `POST /onboarding`             | Bearer (banni OK) | `{ displayName?, email?, occupation?, timeZone? }` (`timeZone` = IANA réel du device, validé serveur, best-effort)                                        | `{ username, done, missing }` (`done` = aller au home)                                                                                                                                                                                                     |
| `POST /auth/providers/sync`    | Bearer            | —                                                                                                                                                         | `{ providers: ["google", …] }` (trio connu seul)                                                                                                                                                                                                           |
| `GET /appeals/mine`            | Bearer (banni OK) | —                                                                                                                                                         | `{ eligible, message }` (toujours 200 ; griser le bouton + afficher `message`)                                                                                                                                                                             |
| `POST /appeals`                | Bearer (banni OK) | multipart `explanation` + `evidence` ×0–3                                                                                                                 | `{ appealId, seq }` + message `Appel nºX envoyé.`                                                                                                                                                                                                          |
| `GET /makers/[username]`       | non               | —                                                                                                                                                         | profil public (jamais email/motif ; `bannedAt` = badge Suspendu ; `isCuration` = badge Veille + clause en bio) ; 404 si inconnu                                                                                                                            |
| `GET /meta`                    | non               | —                                                                                                                                                         | référentiel : `occupations` (id/label/description), `defaultOccupation`, `providers`, `limits` — **lire, jamais hardcoder**                                                                                                                                |
| `POST /urls/check`             | Bearer            | `{ url, force? }`                                                                                                                                         | `{ verdict, status, finalUrl, cached }` (toujours 200 ; `block`/`warn` via politique partagée)                                                                                                                                                             |
| `GET /me/products`             | Bearer (banni OK) | `?limit` (1–50, défaut 20) + `?cursor` opaque                                                                                                             | `{ items, nextCursor }` (curseur keyset, `null` = fin ; miroir dashboard, dates ISO, sans captures)                                                                                                                                                        |
| `GET /me/notifications`        | Bearer (banni OK) | `?limit` (1–50, défaut 20) + `?cursor` opaque + `?unread=1`                                                                                               | `{ items, nextCursor, unreadCount }` (cloche + page ; même service que le web ; items portent `productIconUrl`/`actorAvatarUrl` → visuel, sinon icône de tone)                                                                                             |
| `PATCH /me/notifications`      | Bearer (banni OK) | `{ ids?: string[] }` (absent = tout-lu)                                                                                                                   | `{ updated }` (tout-marquer-lu ou par ids)                                                                                                                                                                                                                 |
| `GET /products`                | non               | `?limit` (1–50, défaut 20) + `?cursor` opaque ; `?q` + `?page` (défaut 1) ; filtres répétés (`types`, `platforms`, `pricing`, `lifecycle`, `ages`, `cat`) | sans `q` : `{ items, nextCursor }` (nouveautés, `null` = fin ; items portent `curated` → badge Veille) ; avec `q` : `{ items, nextCursor: null, page, total }` (pertinence — le rang n'est pas keyset)                                                     |
| `GET /products/[id\|slug]`     | optionnel         | —                                                                                                                                                         | fiche complète (screenshots, maker, `voted` si Bearer valide, `false` sinon) ; 404 si inconnu/dépublié                                                                                                                                                     |
| `POST /products`               | Bearer            | multipart : champs texte + `logo` + `screenshots` ×0–6 (`intent=publish` exige logo + ≥1 capture ; défaut brouillon)                                      | 201 `{ id, slug, status }` (fiche complète en Phase 4 via `GET /[slug]`)                                                                                                                                                                                   |
| `PATCH /products/[id]`         | Bearer            | multipart partiel (absent = conservé ; fichiers = remplacement total)                                                                                     | `{ slug, status, rereview }` (nom/liens d'une fiche published → `pending`)                                                                                                                                                                                 |
| `POST /products/[id]/vote`     | Bearer            | —                                                                                                                                                         | toggle `{ voted, upvoteCount, counted }` (`counted=false` = shadow-weighting : affiché, hors classement) ; 422 + `data.reason: "account_too_young"` (< 1 h) → dialogue explicatif + lien conditions (textes ci-dessous, jamais de match sur le message FR) |
| `GET /products/[id]/reviews`   | optionnel         | `?limit` (1–50, défaut 20)                                                                                                                                | `{ items, distribution }` (moyenne + par-étoile ; `own` si Bearer) — cache court                                                                                                                                                                           |
| `POST /products/[id]/reviews`  | Bearer            | `{ rating: 1-5, body: 10-2000 }`                                                                                                                          | 201 `{ id, rating }` (1/user/produit : renvoie = mise à jour)                                                                                                                                                                                              |
| `GET /products/[id]/comments`  | optionnel         | `?limit` (1–100, défaut 30)                                                                                                                               | `{ items }` (thread 1 niveau, `myVote` si Bearer) — cache court                                                                                                                                                                                            |
| `POST /products/[id]/comments` | Bearer            | `{ body: 1-1000, parentId? }` (parent sans parent, même produit)                                                                                          | 201 `{ id }`                                                                                                                                                                                                                                               |
| `POST /comments/[id]/vote`     | Bearer            | `{ value: up\|down }` (défaut up)                                                                                                                         | toggle `{ voted, score }` (idempotent par clé)                                                                                                                                                                                                             |
| `POST /uploads/presign`        | Bearer            | `{ kind: logo\|shot, contentType, contentLength }` (≤10 Mo, PNG/JPG/WebP)                                                                                 | 200 `{ url, key, bucket, expiresIn }` — PUT direct R2 puis `stagedLogo`/`stagedScreenshots` au submit                                                                                                                                                      |

Idempotence (réseaux fluctuants) : header `Idempotency-Key` (1–64 :
lettres, chiffres, `-_`) sur `POST /products` et `POST /[id]/vote` —
**une clé = une intention** (nouveau vote ≠ nouveau toggle : changer de clé
pour revoter) ; même clé = réponse rejouée à l'identique (201/200 +
`replayed: true`) ; TTL 24 h ; 409 = requête en cours, retry puis replay.
Cache HTTP : lectures publiques `s-maxage` + SWR (`makers` 60 s, `meta`
1 h — **lire, jamais hardcoder**), privé = `no-store` explicite.
Uploads : multipart direct accepté (garde `Content-Length` 413 au-delà
du budget) OU présigné (recommandé : zéro RAM serveur, staging purgé
après submit, balayé à 24 h sinon).
Refetch : lancement, retour focus, pull-to-refresh, après chaque mutation
(vote/submit) — pas de polling, pas de websocket en V1.

Règles produits à réimplémenter à l'identique : types/catégories/platforms/
pricing = vocabulaires fermés (`GET /meta` quand exposés — jamais hardcodés
côté Dart) ; **`galleryOrientation` pilotée par le type** (`app_mobile` =
portrait, desktop/saas/cli/… = paysage, `app_web`/`game`/`bot`/`other` =
choix libre, défaut paysage pour le web) — toute capture hors orientation
= `FILE_REJECTED` (jamais recadrée) ; tagline 1–220 ; logo ≥ 256 px,
captures ≥ 400 px, ratio hors 1:3…3:1 refusé ; quota 6 ;
**compresser côté Flutter (< 2 Mo)** comme §4 (le serveur plafonne à 10 Mo
mais tronque serverless vers ~4,5 Mo).

Règles produit à réimplémenter à l'identique : nom ≥ 2 caractères ;
occupation = `GET /meta` (vocabulaire fermé servi par le backend — jamais
hardcodé côté Dart) ; **fuseau** : envoyer `Intl…resolvedOptions().timeZone`
à l'onboarding et à chaque save profil (les emails partent à l'heure locale
réelle ; sans fuseau capté, repli neutre UTC) ;
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

| Colonne                                                                            | Sens mobile                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `id`                                                                               | UUIDv7, jamais affiché (support : tronqué + copie côté admin web) |
| `username`                                                                         | slug public, **immuable** (URLs `/makers/`)                       |
| `displayName`, `bio`, `occupation`, `websiteUrl`, `socialLinks`, `country`, `city` | éditables (`PATCH /me`)                                           |
| `email`                                                                            | contact, immuable V1 (sauf placeholder → onboarding)              |
| `avatarUrl`                                                                        | CDN public, `null` = initiales (jamais de visage d'emprunt)       |
| `providers`                                                                        | `["google","github","email"]` — source de vérité, sync §1         |
| `role`                                                                             | lecture seule (`user` — admin = web only)                         |
| `bannedAt`, `banReason`                                                            | écran suspendu ; `banReason` = motif à afficher                   |
| `appealsCount`                                                                     | compteur d'appels déposés                                         |
| `onboardingCompleted`                                                              | flag + `GET /onboarding` (`done = flag && !dirty`)                |

## 7. Rate-limits (Upstash, fail-open)

Lectures ~120/min, écritures ~20/min, fichiers ~10/min, sync ~30/min,
suppression 5/min. `429` = attendre une minute (pas de retry immédiat en
boucle). Les verrous métier (appel pending, 24 h) s'ajoutent par-dessus.

## 8. Hors scope mobile v1 (web only, stated)

Admin (`/admin/*`), liaison provider sans `sync`, digest email.
Votes/leaderboard/fiche publique (`GET /products`, `GET /[slug]`,
`POST /[id]/vote`) : Phase 3/4 (même pattern : portes minces sur services).
`POST /[id]/vote` livré Phase 3 ; anti-abus : compte < 1 h refusé,
poids 0 si < 24 h (`counted=false`).

## 9. Dialogue anti-triche (vote refusé / poids 0)

Quand le critère d'âge n'est pas rempli, le mobile affiche un DIALOGUE
expliqué (jamais un toast sec, jamais de boîte noire) + lien `/regles`
(la charte renvoie aux conditions — guideline d'abord, terms ensuite).
Textes FR : COURTS et chaleureux, jamais le texte des conditions
(matchez `data.reason` / `counted`, jamais le message serveur) :

- **422 + `data.reason === "account_too_young"`** (compte < 1 h, vote
  refusé) — titre : « Bienvenue ! Encore une petite heure ». Corps :
  « Ton compte vient de naître — laisse-lui une petite heure, et ton
  vote comptera. En attendant, explore les fiches ! »
- **200 + `counted === false`, 1ère fois** (compte < 24 h, vote accepté
  poids 0) — titre : « Merci pour ton vote ! ». Corps : « Il s'affiche
  déjà ! Il pèsera au classement quand ton compte aura 24 h — c'est
  comme ça qu'on garde le jeu équitable pour les makers. » Une seule
  fois (flag local), ensuite toast simple. Le web fait pareil (mêmes
  textes, shared `ConfirmDialog` en mode informatif).
