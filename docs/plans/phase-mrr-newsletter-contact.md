# Plan — MRR + newsletter + contact + correctifs (état réel)

> Document de pilotage (opérateur + agent). Tenu à jour à chaque lot :
> un statut périmé ici est un bug, pas un retard — cf. règle docs/README.
> Le détail vivant (preuves, vérifications) reste au CHANGELOG.

## 0. Règles permanentes

- **Git en pause** : aucun add/commit/push sans le signal explicite de
  l'opérateur. Il signale toujours le moment. (Ne jamais reparler de
  git tant que le signal n'est pas donné.)
- **Portes avant tout lot** : `npx tsc --noEmit`,
  `npx eslint --max-warnings=0`, `npx prettier --check`, suites
  `verify-*` des chemins touchés UNIQUEMENT, `npm run build`.
- **Zéro chiffre inventé** : vide honnête partout ; échec franc > faux
  chiffre. Un nombre affiché = requête réussie + âge connu (`{value,
ok, at}` côté admin).
- **FR partout en UI**, thèmes clair/sombre, 375 px. Secrets jamais
  loggés, affichés ou committés.

## 1. Exécuté (en attente du signal — ne pas refaire)

### 1a. MRR delta + finitions

- Slide-over « Quel prestataire ? » (soumission) ; badge featured +
  metadata `/revenue` (déjà en place, vérifiés).
- Profil `hasFull` (vrai 0 affiché, masqué respecté) ; revue admin sur
  vue réelle ; stat admin « Clés revenus » ; types admin 5 providers.
- `MrrPlot`, hint `…abcd` + toggle, email failing, workflow + runbook :
  déjà en place, vérifiés.
- Hero home `null` si top vide ; emails wordmark + « Mada-Made » ;
  footer (Guides, Signaler, Contribuer, digest hebdo).
- `verify-revenue` 60/60 (checks `hasFull` ajoutés).

### 1b. Mobile squad (+ demandes suivantes)

- `latestBuild` enrichi, download JSON, updates/check, builds,
  quota 300 Mo.
- `GET /api/v1/makers?limit&sort` (`recent` + `trending` 30 j +
  `score`) — `verify-api-v1` 38/38.
- `occupation` dans `author` de `getProductReviews` /
  `getProductComments` (id brut, label via `GET /meta`, jamais
  d'email) — suite étendue.
- `POST /api/v1/contact` (201 / 422 `VALIDATION`).

### 1c. Newsletter + préavis légal

- Cron `POST /api/cron/digest` (`?dryRun=1`) + workflow lundi 7 h Tana.
- Audience Resend (`run-jobs audience`, webhook `contact.updated`),
  `DigestForm` membres + CTA `/settings` (« Gérer mes emails »),
  paragraphe consentement orphelin supprimé du footer.
- `announceLegalUpdate` + `run-jobs announce` (kind `legal_updated`,
  migration 0042) ; suite 26/26.

### 1d. Contact + admin indestructible

- Migration 0043 (`contact_messages`, RLS deny-all) ; `/contact` +
  nav ; inbox `/admin/contact` + pastille ; `verify-contact` 16/16.
- Pastilles admin lazy : endpoint `GET /api/admin/badges`
  (`{value, ok, at}`, allSettled, `?keys=`), shell fetch mount +
  pathname + focus avec retry auto borné (batch → +1,5 s → +4 s, stop
  silencieux, zéro re-clic), layout réduit au gate. Suite
  `verify-admin-badges` 5/5.

### 1e. Guides + marque

- Chips guides avec logos (`siblings.logo` + `logoDarkInvert`,
  source `REVENUE_LOGO_DARK_INVERT`) ; `ProviderTable` pilotée par
  les specs (table markdown supprimée) ; phrases de connexion
  corrigées (hub + 5 fiches : vrai chemin submit → « Détails
  techniques & modèle » → toggle) ; bloc « Déclinaisons » wordmark
  sur `/about` (polarité webp vérifiée par pixels).
- `docs/README.md` : index des 35 fichiers (vivant vs archive).

## 2. Décisions tranchées (ne pas rouvrir sans raison)

- 5 adaptateurs MRR d'un coup ; zéro conversion devise ; essais et
  `past_due` exclus ; `interactionStatistic` abandonné ; BÊTA partout
  sauf badge public.
- Newsletter = inscrits seuls, digest per-user en Resend direct,
  one-shot en Broadcasts ; opt-out unique `digest_opt_out` (sauf
  préavis légal = contractuel, opt-out ignoré).
- Contact = table + inbox (pas d'email seul), 5 motifs, réponse via
  client mail, labels motifs en module pur (`lib/contact-subjects`).
- Pas de plateforme docs façon Vercel (pas de lecteurs) ; pas de
  CAPTCHA (honeypot + rate-limit) ; pas de polling (focus + mount).
- Convention `mm_logo_*` : suffixe = thème cible (vérifié par pixels,
  PNG et webp — l'hypothèse inverse a failli passer).
- Quota APK : **300 Mo** (`lib/apk-limits.ts` fait foi).

## 3. Reste opérateur (hors code)

- Vercel env + GitHub Secrets (`REVENUE_KEY`, `CRON_SECRET`,
  `SITE_URL`, `RESEND_AUDIENCE_ID`) + runs manuels.
- Domaine Resend vérifié (test-mode = muet).
- Audience « Mada-Made » créée + webhook `contact.updated` souscrit.
- Retest terrain + retest `/admin` (kill dev, rm `.next`, relancer).
- `run-jobs announce` le jour d'un changement légal.

## 4. Mémoire anti-erreur (constats de session)

- `db.execute` brut = snake_case + dates en string → normaliser dans le
  service (jamais de `.toISOString` sauvage).
- Migrations drizzle : vérifier `_journal.json` + renommer avant
  d'appliquer (historique off-by-one, 0037×2) ; entrée fantôme
  `__drizzle_migrations` = « appliquée sans effet ».
- `.env.local` : éditer sans BOM (writer Node, pas `Set-Content`),
  `next dev` recharge à chaque démarrage.
- PowerShell 5.1 : commandes <60s, pas de `&&`/`head`/`grep`/`||`,
  pas de serveur en fond — suites `tsx` + `build` en petits lots.
- Secrets : `.env.local` gitignoré, `SITE_URL` sans slash final,
  `CRON_SECRET` identique partout.
- Ne lancer que les suites des chemins touchés (reproductions
  gratuites interdites) ; ne parler de git que sur signal.
- Client bundle : jamais d'import runtime d'un module serveur
  (labels partagés en module pur, types en `import type`).
- System.Drawing ne lit pas le webp : échantillonnage via sharp.
