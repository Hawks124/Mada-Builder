# Auth & Comptes — référence contributeur

> Stratégie : Supabase Auth (Google + GitHub + OTP email), Drizzle côté app,
> RLS strict, sessions rafraîchies par proxy. Email = OTP custom Resend
> (web) ; mobile = OAuth natif + API v1 (voir `docs/mobile-contrats.md`).
>
> Règle d'or RLS : PostgREST ne voit QUE sa propre ligne (`auth.uid() = id`).
> Toute lecture large (makers publics, admin) passe par Drizzle serveur
> (service_role) avec allowlist de colonnes — jamais l'email en public.

## 1. Setup Supabase Dashboard (manuel, une fois)

- [ ] Projet créé → renseigner `.env.local` depuis `.env.example`
- [ ] **Auth → Providers** : activer Google (Client ID/Secret Google Cloud),
      GitHub (OAuth App : homepage + callback `https://xyz.supabase.co/auth/v1/callback`),
      Email (OTP activé, **pas** de SMTP custom — l'OTP passe par Resend, §7)
- [ ] **Auth → URL Configuration** : Site URL = domaine prod, Redirect URLs +=
      `http://localhost:3000/**` (dev) + `https://domaine/**` (prod)
- [ ] **Storage** : buckets `avatars` (public) et `appeals` (privé) — créés par
      `npm run db:setup`, vérifier policies dans Storage → Policies
- [ ] **Database** : `npm run db:migrate:local` puis `npm run db:setup`
      (trigger, RLS, buckets — le tout idempotent)

## 2. Rôles — matrice (user | moderateur | admin)

| Action                                 | admin                    | moderateur | user |
| -------------------------------------- | ------------------------ | ---------- | ---- |
| Panel, ban/déban, appels               | ✅                       | ✅         | ❌   |
| Nommer/rétrograder user ↔ moderateur   | ✅                       | ❌         | ❌   |
| Toucher au grade admin (les deux sens) | ❌ UI (SQL founder only) | ❌         | ❌   |
| Se toucher soi-même (grade/ban)        | ❌ (garde)               | ❌ (garde) | —    |

Le modérateur fait tout l'opérationnel, zéro gestion de grades
(séparation des devoirs : qui nomme s'entoure). Voie UI : page
`/admin/users` (dialog + email best-effort). Gardes service :
banni → débannir d'abord, self-touch refusé, dernier admin verrouillé.
Miroir JWT via `updateUserById` (merge `app_metadata`) + fallback DB
dans proxy/layout quand le JWT est muet (promotion immédiate, sans
re-login). Secours SQL :

```sql
-- 1. Rôle table (vérité backend)
UPDATE public.users SET role = 'admin' WHERE email = 'toi@mail.com';
-- 2. Miroir JWT (lu par le proxy, zéro requête DB par hit)
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
WHERE email = 'toi@mail.com';
-- 3. Re-login obligatoire (nouveau JWT), puis vérifier /admin.
```

## 3. Enforcement (proxy + layouts)

> Convention Next 16 : `proxy.ts` (ex-`middleware`). Runtime nodejs imposé.

- Actif **dès que les clés Supabase existent** (dev comme prod) : dashboard /
  settings / submit exigent une session (`/signin?next=`), `/admin/*` exige
  `role=admin` (JWT `app_metadata`, miroir §2), sinon `/`.
- **Sans clés** (contributeur sans backend) : laisse passer, l'app tourne en
  mock. Porte sans serrure = pas verrouillée ; documenté ici, pas caché.
- `/api/*` hors proxy : Bearer + 401/403 JSON, jamais de redirect (§16).
- Tester le gate : déconnecté → `curl /dashboard` et `/admin` (307) ;
  connecté `role=user` → `/admin` redirige `/` ; passé `admin` (+ re-login
  pour le JWT) → 200.

## 4. Règles à ne jamais casser

1. **Jamais `select *` sur `users`** — allowlist explicite (l'email ne sort
   que via service_role + ownership). La RLS ne filtre que les lignes,
   jamais les colonnes.
2. **Jamais `role`/`email`/`username` dans un schéma d'update** — Zod strippe
   l'inconnu, mais ne les y mettez même pas (mass-assignment).
3. **Jamais de service_role côté navigateur** — server only (services, actions,
   routes API, scripts). Le finder `grep -r service_role --include=*.tsx components app`
   doit rester vide.
4. **Jamais de suppression user côté admin** — ban réversible uniquement
   (voir `docs/adr/002-ban-only-moderation.md`).
5. **Jamais de secret en log** — clés API, tokens, JWT.

## 5. Username — contrat

- Généré au signup (trigger `handle_new_user`) : slug + suffixe si
  collision. **Immuable ensuite** (SEO) — correction : SQL admin only.
- Réservés : `admin api settings dashboard signin signup makers products
categories revenue search donate regles confidentialite conditions root
support help about` (miroir TS dans `users.service.ts` + trigger — les
  tenir synchronisés).
- Validation : `usernameSchema` (Zod, 3-20, `[a-z0-9-]`).

## 6. Multi-providers — règles strictes

- Auto-link **si et seulement si** email vérifié par le provider.
- Interdiction de délier le dernier provider (garde `addAuthProvider` + UI).
- Email primaire immutable V1. L'OTP email compte comme provider à part entière.
- Mobile : liaison native + `POST /api/v1/auth/providers/sync` (le trigger
  ne pose que le premier provider — voir `docs/mobile-contrats.md`).

## 7. OTP email custom (Resend) — web only

**Pourquoi pas le template Supabase** : non éditable en free (lien seul,
pas de `{{ .Token }}`), et les liens magiques se font manger par les
prefetchers (Safe Links → "Token expired"). Nous générons le code 6 chiffres
(template 100 % custom FR, immunisé prefetch) ; **Supabase reste la seule
autorité de session** — aucun fork d'auth.

**Flow** (`services/otp.service.ts` + `app/actions/auth.ts`) :

1. Demande → `requestEmailCode` : throttle Upstash 60 s/email (façade
   partagée `lib/ratelimit`), suppression des codes précédents (un seul
   actif), code `crypto.randomInt` 6 chiffres, `generateLink(magiclink)`
   avec double repli (compte inexistant → `createUser({ email_confirm: true })`
   **sans mot de passe**, puis retry). Insert `{ code_hash SHA-256,
action_link, token_hash, expires 10 min }`. Envoi Resend (code + lien
   de secours). Échec transport → ligne supprimée (retry immédiat propre).
2. Throttle ou email malformé : réponse OK silencieuse / erreur générique
   (anti-énumération — le code précédent reste valide dans la boîte).
3. Vérification → comparaison `timingSafeEqual`, +1 tentative par échec,
   **burn à 5**, delete-on-use. Au succès : **échange server-side**
   (`verifyOtp({ token_hash })`, `lib/supabase/exchange.ts`) — le navigateur
   ne visite JAMAIS Supabase, la session est posée en cookies côté serveur.
4. Lien de secours du mail = NOTRE `/auth/exchange?h=&next=` : vérifie
   d'abord notre ligne (existe + non expirée + inutilisée → notre TTL
   10 min borne aussi le lien), delete-on-use, puis échange. `?error=`
   mappé en FR sur /signin dans tous les cas.
5. Erreur publique TOUJOURS `"Code incorrect ou expiré."` (incorrect /
   expiré / épuisé indistinguables — anti-oracle). `reason` interne loggée
   sans PII.

**Paramètres** (changer l'un = changer les autres) : `OTP_TTL_MIN=10`
(service + template + copie signin-form), `OTP_MAX_ATTEMPTS=5`,
`OTP_REQUEST_WINDOW` 60 s / 1 demande (service seul — le cooldown client
30 s du form est de l'UX anti-double-clic, pas de la sécu).

**Setup Resend** : clé dans `RESEND_API_KEY`, `RESEND_FROM`. Mode test
(domaine non vérifié) = envoi restreint à l'adresse du compte, expéditeur
`onboarding@resend.dev`. Domaine vérifié requis pré-lancement (DNS).

**Tables** : `auth_otp` — `code_hash` seul, jamais le clair ; cleanup
expirés : `cleanupExpiredOtps()` (cron V1.5).

**Règles** : jamais d'OTP en clair en log, en DB ou en réponse (SHA-256 au
repos, mémoire volatile côté action). `after()` : fond sans scope requête
— `cookies()`/`headers()` y sont morts ; lire la requête AVANT.

## 8. Écran vérification OTP (Zéro UI, dédié)

`emailSent` = écran plein cadre (titre "Vérifiez votre email", cases
`h-16 text-2xl`, providers masqués) — jamais un panneau incrusté sous
"Bienvenue" (confusion QA). Persistance `lib/otp-pending.ts` :
sessionStorage (refresh) + localStorage borné 10 min (close/reopen),
purge au-delà — le code serveur meurt aussi à 10 min. "J'ai déjà reçu
un code" (sans renvoi) + "Choisir une autre méthode" (abandon, purge
totale). Auto-submit, collage global, ARIA : inchangés.

## 9. Onboarding /bienvenue (gate profils + premier contact)

GitHub sans email → trigger placeholder `@placeholder.local` (au lieu
d'un crash NOT NULL) ; gate layouts (site/dashboard/admin/auth) :
`onboarding_completed` d'abord, heuristique placeholder/nom-court en
filet, banni avant tout, exclusions `/bienvenue` + `/auth/*`, coût zéro
invités. Incontournable en pratique : re-gate serveur à chaque load
(refresh/close/nouvel appareil couverts), Zod serveur anti-tampering,
fail-open DB accepté (la gate protège la qualité data, pas un périmètre
sensible — aucune mutation n'en dépend). `?next=` perdu par la gate
(retour `/dashboard` par défaut). Page `(onboarding)` dynamique
UNIVERSELLE : nom toujours demandé (pré-rempli provider SAUF pattern
`missing-xxxxxxxx` trigger — jamais de garbage validé au clic),
occupation optionnelle-recommandée, email seulement si placeholder ;
en-tête adapté au provider (jamais de GitHub hardcodé). `completeProfile`
: colonnes fournies seules (+ flag), email modifiable ssi placeholder
(unicité case-insensitive, anti-squat), création si ligne absente.
Email = contact/modo, jamais l'auth Supabase. Mobile : mêmes règles via
`GET/POST /api/v1/onboarding` (voir `docs/mobile-contrats.md`).

## 10. Ban — enforcement + appels + audit + temps réel

- **Victime** : `(dashboard)/layout` rend `SuspendedScreen` (motif, appel,
  suppression RGPD, déconnexion) AU LIEU des enfants — aucune nav, aucun
  formulaire. Badge "Suspendu" page maker (transparence, pas d'effacement).
- **Enforcement** : `assertNotBanned` en tête des mutations (profil, avatar,
  link/unlink — submit/votes au milestone listings) + RLS `banned_at IS
NULL` sur les writes users/storage (`setup.sql`). Seules écritures
  bannies : suppression de compte + dépôt d'appel (service_role).
- **Appels** : table `appeals` + bucket privé `appeals` (insert own-path
  bannis inclus, lecture service seule, liens signés 72 h à la volée) ;
  explication 10-2000 + 0-3 pièces img/PDF ≤ 10 Mo (magic-bytes serveur).
  `appealsCount` incrémenté au dépôt ; `seq` figé (`Appel nºX`, unique par
  user, jamais renuméroté).
- **Rate-limits d'appel** : pending unique (structurel) + 24 h entre dépôts
  (pacing). Conservés après revue : pas de reset au déban (une règle, pas
  de couplage audit, abus inexploitable).
- **Emails** (Resend, best-effort) : `ban-notify` (victime, motif + CTA
  appel) · `appeal-notify` (`ADMIN_EMAILS`, motif + explication + pièces)
  · `appeal-decision` (victime, rétabli/maintenu — ton fraternel, porte
  rouverte : appels illimités, jamais de "définitif") · `unban-notify`
  (déban direct, sans mention d'appel). Déban direct : clôt les appels
  pending en `overturned` silencieux (pas de double envoi). Marque
  partagée (`brand.ts`, logos PNG) + footer juridique (Charte/Conditions/
  Confidentialité) + footer modération incitatif sur les 3 emails victimes.
- **Admin** : filtre "Appels (N)" + carte par appel (identité partagée
  `StaffIdentity` : avatar, providers à logos, email, ID-copie, `Appel nºX`)
  - "Débannir" (`unban` + `overturned`) / "Maintenir" (`upheld`). Ligne
    mobile : menu `⋯` (desktop inline inchangé). Temps réel par event
    Realtime (`appeals:inserts`, RLS `appeals_select_staff`) — zéro polling.
- **Audit trail** (`admin_actions`, RLS deny-all) : chaque ban/déban/
  grade/décision loggé fail-soft (jamais bloquant). Compteurs = COUNT
  **non-nuls uniquement** (jamais de "0×" : l'audit post-suivi ne connaît
  pas les bans pré-suivi) + entrée fantôme "Banni — avant le suivi" quand
  débans/appels existent sans ban tracé + timeline paresseuse par ligne
  (acteur — "ancien admin" si supprimé — libellé, note, date).

## 11. Callback OAuth — leçon cookies (bug réel, QA 2026-09)

Symptôme : exchange réussi (lignes `auth.users` + `public.users` créées)
mais navigateur sans session → boucle `/signin?next=`. Cause : `setAll`
posait les cookies sur la réponse puis le code la **remplaçait par une
vierge** (`response = NextResponse.redirect(...)`). Règle : en route
handler, `getAll` depuis les headers entrants, `setAll` **uniquement**
sur LA réponse retournée, jamais réassignée. Gardes ajoutés : `?error=`
mappé en FR + `captureMessage` serveur (nom seul). Miroir providers[] :
synchroniser TOUTES les identités de l'exchange (`data.user.identities`),
jamais `app_metadata.provider` seul — après un link, celui-ci reste le
provider d'origine (vu en QA : `["google"]` vs GitHub+Google réels).

## 12. Post-mortems (deux causes empilées, même symptôme)

1. **Confusion invité/incident** : `getSessionUser()` avalait les incidents
   réseau (`.catch(() => null)`). Règle : **jamais de redirect sur du
   non-vérifié** (`getViewer()` : 401/403/404 = invité, reste = incident
   - retry unique, fail-open/fail-closed explicites par porte).
2. **Deux prédicats divergents** (pire) : la gate lisait le FLAG pendant
   que la page lisait les CHAMPS (ping-pong /dashboard ↔ /bienvenue
   déterministe). Règle : **une gate, un prédicat partagé**
   (`getOnboardingStatus` : `done = flag && !dirty`). Ancienne fonction
   double supprimée, pas dépréciée.
   SIMULATE_AUTH_OUTAGE=1 (dev) force le chemin incident. Exceptions
   assumées : layout admin fail-closed (/), pas de disjoncteur (V1.5).

## 13. Feedback — canal toast vs inline (règle)

- **Redirect → `?toast=tone:message`** (`lib/toast.ts` + `ToastViewport`
  au root) : tones `ok/err/info`, ≤ 120 signes, nœud texte (XSS
  impossible). Consommé une fois puis nettoyé de l'URL.
- **Même page → inline** (formulaires signin/profil/OTP, admin rows,
  DangerZone). Upload avatar : `bodySizeLimit: "12mb"` + garde client
  10 Mo + copie "max 10 Mo".

## 14. Fail-open honnête + avatars résilients

- `getViewer()` mémoïsé par requête : gate + layouts + pages partagent UN
  appel. `isViewerDegraded()` → `DegradedBanner` ("affichage de
  démonstration" — le fail-open s'affiche, jamais en silence).
- `AvatarImage` partagé (src nullable + nom + taille) : initiales si
  absent, `onError` → initiales si échec. Taille fixe.
- Test d'injection : `SIMULATE_AUTH_OUTAGE=1` (.env.local, dev-only,
  jamais commité) → parcourir /, /dashboard, /bienvenue, /admin,
  /signin → retirer → retour nominal.

## 15. Commandes utiles

```bash
npm run db:generate       # SQL depuis le schéma (TOUJOURS relire avant push)
npm run db:migrate:local  # applique db/migrations — jamais drizzle-kit direct
                          # (il ne charge pas .env.local : le script charge
                          # scripts/_env puis délègue, zéro secret en log)
npm run db:setup          # trigger + RLS + buckets (idempotent, 31 instructions)
npm run db:ping           # tables + version PG
npx tsx scripts/verify-*.ts  # garde-fous (OTP, toasts, emails, API v1… — nettoient après eux)
```

## 16. API v1 & mobile — pointeur

Auth Bearer (Supabase Auth native côté Flutter, OAuth only MVP), enveloppe
`{ok, code}`, rate-limits Upstash, 404 JSON. Référence complète :
`docs/mobile-contrats.md`. L'email/OTP custom reste web-only.
