# Changelog

Tous les changements notables du projet, en français. Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage sémantique. Ceci n'est **pas** encore un MVP : voir `Non-inclus` ci-dessous.

## [Non versionné]

### Ajouté

- Curation mobile : `isCuration` dans `GET /makers/[username]` (badge
  profil, clause en bio — jamais de hardcode côté app) ; lecture directe
  documentée en voie première (`docs/mobile-contrats.md` §1-bis,
  `docs/data/products.md`) : colonne `curated` → badge « Veille »,
  vote/avis désactivés avec note, commentaires ouverts, produits d'un
  maker via `maker_id` direct.
- Vote loyal expliqué partout : dialogue court et chaleureux (lien vers
  les règles, jamais le texte des conditions), règle « Des votes loyaux »
  enrichie dans la charte (`/regles` → détail dans `/conditions`),
  section « Le saviez-vous ? » dans la sidebar submit.
- `ConfirmDialog` : mode informatif à bouton unique (`hideCancel`) ;
  `VoteButton` migré dessus, `vote-gate-dialog.tsx` supprimé.
- **Faille shadow-weighting corrigée** : le `weight = 0` était figé à
  l'INSERT pour toujours — le sweep 15 min promeut désormais à 1 les
  votes des comptes devenus majeurs (TS `recomputeScores` + SQL
  `recompute_product_scores()`, bannis/supprimés exclus), avant le
  rescore du même passage ; le dialogue « il pèsera au classement »
  est donc vrai. Check `verify-votes-ranking` 3-bis (30/30).
- **Comptes factices purgés + fuites bouchées** : 6 comptes de test
  (`verify-otp-*`, `probe-otp-*`, `verify-backend`) polluaient la DB —
  `verify-otp-mobile.ts` (EMAIL_2 jamais purgé, emails timestampés
  irrattrapables → emails fixes + purge des deux + balayage du
  préfixe), `verify-products-backend.ts` (maker jamais purgé →
  purgé §12), `verify-profile-backend.ts` (purge pré-run `@mail.com`).
  Faux compteur « 691 produits » (mock en dur) remplacé par le vrai
  total publié + counts par catégorie réels (`getProductsCount`,
  `getPublishedCountByCategory`).
- **Licence** : refonte `LicenseImporter` au standard README (segmented
  Fichier|URL, dropzone, `accept` retiré — les LICENSE/COPYING sans
  extension étaient cachés par le dialogue OS), `resolveRawFile`
  convertit les URLs de page GitHub/GitLab (`/blob/`) en raw.
- **Catégorie Sport** : existait dans le hero mais pas dans
  `PRODUCT_CATEGORIES` (submit/validation/filtres) ni les familles —
  ajoutée (36 catégories, famille Quotidien) ; hero top 7 dynamique par
  counts réels (ordre éditorial si tout à 0).
- **Bug R2 attrapé par un nouveau check** : `r2KeyFromUrl` amputait le
  1er segment du path (style path-style) alors que les domaines publics
  sont par bucket (style racine) → les purges supprimaient une clé
  inexistante, orphelins silencieux à chaque remplacement. Corrigé
  (path complet par défaut) ; section 13 `verify-products-backend`
  (remplacement logo+galerie, purge R2 prouvée : 119/119).
- **`/admin` figé sur son skeleton** : `getStats()` (17 requêtes en
  `Promise.all`) ne se terminait jamais — slots du pool bloqués sur des
  connexions mortes (Supavisor tue les idle sans RST, aucune détection,
  attente infinie). Fixes : `idle_timeout: 10` + `max_lifetime: 300`
  (pool auto-récupéré), 5 comptages produits batchés en 1 requête
  (`getProductsCountByStatus`), `Promise.all` des awaits séquentiels,
  `getPendingCountCached` partagé layout+page, `loading.tsx` admin.
- **FAILLE persistance de privilège (stale JWT)** : `open-sources`,
  promu moderateur le 24/09, demoted `user` en DB directe par
  `setup-curation-account` sans sync le miroir → son JWT disait encore
  `moderateur` et le layout (JWT-first) le laissait entrer dans `/admin`.
  Fixes : miroir re-syncé, layout = vérité DB (fini le JWT-first),
  `syncRoleMirror()` partagé (action + script), audit miroirs.
- **Home anti-crash** : `getNewest`/`getFeatured`/`getLeaderboard`/`votedIds`
  avec fallbacks — une requête DB qui pète ne fait plus une page blanche.
- **Logos réels** : dashboard maker + file review affichent l'`icon_url`
  quand il existe (repli tuile initiales inchangé) ; `iconUrl` transporté
  dans `DashboardApp`/`ReviewItem`.
- **Empty states unifiés (14)** : `EmptyState` partagé (lottie astronaute)
  partout — produit du jour, dashboard maker, leaderboard, avis,
  commentaires, recherche catégories, notifications (page + cloche sobre),
  connexions revenus, file/historique admin ; admin en sobre (`none`/`sm`),
  galerie et textes informatifs exclus (pas des états vides).
- **Digest → settings + fix occupation** : opt-out déplacé du formulaire
  profil vers `/settings` (switch immédiat `updateDigestPref`, formulation
  positive, sans le piège du reset à chaque save) ; `ProfileOccupation`
  ne bubble aucun change natif → prop `onChange` → save réactivé ;
  mobile : `digestOptOut` dans `GET /me` + `PATCH /me/preferences`
  (service `setDigestOptOut` partagé, testé).
- **Re-soumission après rejet** : `updateProduct` ignorait le cas
  `rejected + publish` (la fiche restait rejetée, le maker croyait l'avoir
  republiée) → retour en file avec les mêmes règles que la publication,
  motif effacé, même ligne (prouvé : sans doublon). Redirect auto vers la
  file après verdict + redirect file (vs 404) si dossier déjà tranché.
- **Dashboard maker anti-crash** : engagement/rangs/notifs avec fallbacks
  (fini la page blanche sur slot pool mort).
- **Vrais chiffres avis** : `getFeedbackStats()` (avis visibles, commentaires,
  note moyenne) remplace les "0 / avis en Phase 5" hardcodés.
- **Section Rejetés** (`/admin/rejected`, nav + badge) : réutilise
  `ReviewQueue` en variante (même design, pill "Rejeté", bouton "Rappeler",
  motif visible, "Rejeté depuis X j" + dernier rappel) ; `/admin/products`
  = publiés uniquement. Rappel maker : template `product-nudge`,
  cooldown 3 j (bouton + barrière serveur), audit `product_nudged`
  (migration 0030). Motif du rejet affiché dans la ligne.
- **Visuels réels activité + notifications** : logos produits et avatars
  makers dans l'activité récente (fini le "+0" parasite) ; cloche et page
  notifications avec logo > avatar > icône (contrat mobile à jour).
- **Fiche admin en markdown** : la description du dossier de revue utilise
  `Prose` (même renderer que la fiche publique — fini le brut `#`/`**`).
- **Dashboard maker réorganisé** : section « Mes produits » dédiée
  (`/dashboard/products`, nav + helper `getMakerAppsDashboard` partagé) ;
  la vue d'ensemble garde greeting + stats (+ futurs graphes).
- **D0 `submitted_at`** : le SLA 24 h part de la (re-)soumission en file,
  jamais de la naissance du brouillon (migration 0031, écriture
  submit/update/resubmit/re-revue, lecture + tri file, backfill ;
  section 13-bis verify : draft=NULL, publish=posé, resubmit=reset ;
  122/122).

- Milestone products Phase 1–2 : schéma (`products`, `product_screenshots`,
  `votes`, `product_page_views`), liens JSONB par field-id, RLS, buckets R2,
  seed dev-only, `verify-products-backend` 49/49 hermétique.
- Médias : orientation pilotée par type, uniformité par fiche (intrus rejeté,
  jamais recadré), logo `contain` transparent, quota 6 captures, clés `.webp`.
- Submit réel + brouillons vivants (`?edit=` pré-rempli complet), file de
  revue admin branchée DB (approve/reject + emails), dashboard maker branché
  DB, suppressions RGPD confirmées.
- API v1 mobile : `POST/PATCH /products`, `GET /me/products` (multipart,
  même contrat que le web) + `docs/mobile-contrats.md`.
- Review phases 1+2 (`docs/reviews/phase1-2.md`) : 3 bloquants corrigés
  (redirect avalé, submit catégories involontaire, changelog effacé),
  10 majeurs (guard orientation avant commit, règles liens serveur,
  purge R2 admin, revue atomique, suppressions RGPD banni, erreurs
  honnêtes, notif retrait `product-removed`), purge brouillons 90 j,
  protection `beforeunload`, colonne `shares_data` (migration `0017`).
  M7 rétracté (code déjà conforme) ; M4 résolu sans retrait destructif
  (revenus désactivés + mention, tiers câblé pour de vrai).
- Phase 3 (boucle de vote) : `toggleVote` optimiste (shadow-weighting,
  recompte exact, rescore immédiat, vote en attente rejoué), leaderboard
  onglets DB + SEO, produit du jour à volume variable + override admin,
  discover/newest en parité (tri dans l'URL), jobs pg_cron + `run-jobs`,
  mobile `POST /[id]/vote`, compteurs seed remis à zéro (migration
  `0018`), `verify-votes-ranking` 28/28.
- Phase 5 inscrite au milestone : signalement produits (bouton sidebar
  aujourd'hui mort, motifs validés).
- Phase 6 (API hardening large) : idempotence `Idempotency-Key` (submit,
  vote + table TTL 24 h), garde 413 multipart, cache HTTP lectures
  (public SWR, privé `no-store`), curseur keyset (`GET /me/products` +
  index composite), uploads R2 présignés staging + sweeper 24 h, JWT
  local + repli distant, contrats mobile à jour. Scope mobile : lecture
  - vote (submit/edit conservés, soumission web-first en pratique).
- 4A-bis : section submit « Marchés & langues » (tokenisé, pré-rempli en
  édition), fiche +2 MetaRows (Pays cibles, Langues) + indicateur
  Partage de données, fix édition (champs enfin modifiables), roundtrip
  testé (`verify-products-backend` 72/72).
- 4B : recherche plein texte FR (tsvector pondéré GENERATED + GIN,
  migration `0023`, fallback trigram, tri pertinence), sitemap dynamique
  (produits/catégories/makers/statiques) + robots (`Disallow` privé),
  `NEXT_PUBLIC_SITE_URL` requis en prod (`verify-products-backend`
  78/78).
- SEO-max : RLS ré-appliqué + sonde anon, canonical absolue, twitter
  large, JSON-LD honnête + fil d'Ariane (zéro note tant qu'avis mocks),
  OG générées `/og/[slug]`, ItemList discover/catégories/leaderboard
  (`verify-products-backend` 84/84).
- 4C : profils makers publics (produits + totaux réels, SEO ProfilePage,
  démo supprimée) ; dashboard vues + clics réels par produit et totaux
  (batch 2 requêtes), carte Clics, deltas honnêtes ; fix `ProductCard`
  sans `"use client"` (cassait le build dès import serveur direct)
  (`verify-products-backend` 89/89).
- 4D : `GET /products` (keyset nouveautés + recherche pertinence,
  filtres partagés web/mobile) et `GET /[id|slug]` (fiche + `voted`
  optionnel) ; contrats mobile à jour (`verify-products-backend`
  95/95).
- Fix nav : toggle + avatar dupliqués entre 640 et 768 px (breakpoints
  `sm`/`md` incohérents, alignés sur `md`).
- Fix home : teaser classement en cascade (première fenêtre non vide +
  label) au lieu des faux-onglets vers du vide ; empty states
  contextuels par fenêtre sur `/leaderboard`.
- Lot submit UX : `name="tagline"` manquant (cause du « Champs
  invalides »), erreurs Zod nommées par champ, compteurs live +
  validation inline chaque champ (miroir serveur draft/publish) + focus
  premier fautif, vérif inline changelog, sous-titre config dynamique,
  preview markdown (même rendu que la fiche), route `POST /api/submit` +
  XHR vrai % + overlay bloquant (état jamais reset), brouillon auto
  `localStorage` ; fix sweeper R2 (`staging` dans IN UUID = crash).
- Lot submit UX (retours test) : bouton B trim (fini le `**dolor **`
  qui ne parse pas) + aide gras, overlay selon intent, reset intent
  après tentative (fini le publish-surprise au clavier), publish depuis
  l'édition (draft → pending + règles publish, avant : statut jamais
  changé), compression client WebP (draft rapide), médias existants
  affichés en édition (fini le « remis à zéro »), draft → section
  brouillons (`verify-products-backend` 100/100).
- Fix R2 : URLs `{base}/{bucket}/{key}` 404 sur r2.dev (domaines par
  bucket, style racine) → bases par bucket (`R2_PUBLIC_LOGOS_BASE` /
  `R2_PUBLIC_SHOTS_BASE`, blocs dev/prod en `.env.example`), backfill
  one-shot (1 logo + 6 captures), garde HEAD post-upload (erreur
  franche au lieu de fiches cassées), PUT parallèles, tailles
  « X Mo → Y Mo » dans l'overlay ; draft création sans images + label
  (`verify-products-backend` 103/103).
- Lots admin/stats : badge revue + table produits DB (suppression motif
  requis), strip plateforme 15 cartes, activité réelle (audit +
  soumissions + inscriptions), maker CTR/rang top 15/vues 7 j/notif,
  emails (`email_logs` + webhooks Resend), submit slot 6/6 + grille
  unifiée (`verify-products-backend` 108/108).
- Audit zéro mock : badge/table/stats/activity admin réels, cloche
  maker réelle (emails), connexions vide honnête, SEO fiche vérifié
  (`aggregateRating` conditionnel) (`verify-products-backend` 109/109).
- Avis + commentaires : 1/user/produit, note + texte, réponse maker
  officielle, thread 1 niveau, votes toggle, modération staff, fiche
  réelle, notes partout, `aggregateRating`, API mobile
  (`verify-reviews-comments` 24/24).
- Fix hydratation submit : brouillon local lu pendant le rendu client
  (compteur 8 vs 0 serveur) → lecture post-montage + remontage clé
  (1er rendu SSR-identique).
- Notifications temps réel : table + émission (revue/modo/rôles/
  appels/avis/comments/milestones/digest hebdo + opt-out), cloche +
  page + watcher, mobile, purge (`verify-notifications` 18/18).
- Import README : 3 sources (fichier/colle/URL, SSRF-safe) → éditeur,
  pipeline idempotente, Prose durci (`verify-readme-import` 14/14).
- Import README v2 : HTML→markdown (tags/tables/details), remark-gfm,
  dropzone fichier (`verify-readme-import` 26/26).
- Curation OSS : flag + badge Veille + hors jeu (votes/avis off,
  commentaires ouverts) + purge seeds + licence SPDX-only + compte
  configuré (`verify-products-backend` 113/113).
- Plateforme Linux + catégorie Sport (+ icônes source unique côté
  admin) ; suggestions desktop/jeu à jour.
- Tagline 220 (title SEO = nom seul, OG tronquée) ; App Web en
  orientation libre (défaut paysage, pré-remplie en édition)
  (`verify-products-backend` 114/114).
- Vote-gate : code machine `account_too_young` (plus de match texte),
  clause anti-triche dans /conditions, dialogue explicatif web
  (refus + 1er poids 0, lien conditions), contrat mobile §9
  (`verify-votes-ranking` 29/29).
- Hybride mobile : OTP email (session JSON), docs data par table (20
  fiches), RLS lecture complétées + faille `featured_products` fermée
  (`verify-otp-mobile` 5/5).

## [0.1.0] — 2026-09-24 — Fondations, identité & modération

### Ajouté

- Auth Supabase : Google, GitHub, email OTP custom (Resend, code 6 chiffres, 10 min, single-active, création paresseuse, anti-énumération).
- Gate onboarding `/bienvenue` inbypassable (flag + données propres, placeholder GitHub-sans-email géré).
- Profil maker : lecture publique, édition validée (Zod whitelist), avatar (sharp 512px WebP, magic-bytes), suppression RGPD réelle (auth → storage → ligne).
- Liaison multi-provider (Google/GitHub/email), garde dernier-provider, miroir JWT des rôles.
- Écrans banni : `SuspendedScreen`, appel avec pièces (bucket privé, liens signés 72 h), cooldown 24 h + pending unique, `seq` figé (`Appel nºX`).
- Admin : liste users (keyset, recherche, compteurs), ban/déban motivés, grades user↔modo, historique d'audit (`admin_actions`), file d'appels temps réel (Realtime, plus de polling).
- Emails transactionnels FR (6 templates) : marque, footer juridique (Charte/Conditions/Confidentialité), footer modération incitatif.
- API v1 mobile (`/api/v1/*`) : enveloppe `{ok, code}`, Bearer, rate-limits, CORS, 404 JSON — `me`, avatar, onboarding, `providers/sync`, appels, makers publics.
- Observabilité : Sentry (erreurs, sans PII), scripts `verify-*`, rate-limit Upstash fail-open.

### Sécurité

- RLS deny-all par défaut (`auth_otp`, `appeals`, `admin_actions`, `page_views`) ; `users` : lecture/écriture soi uniquement + garde banni ; clés de chiffrement jamais loggées.
- Secrets jamais dans `app/`/`components/`, jamais dans les logs, jamais côté client.

### Non-inclus (V1 restant, par ordre)

Listings produits · leaderboard + vote · catégories/recherche · revenus vérifiés (Stripe/RevenueCat) · monétisation · digest email.
