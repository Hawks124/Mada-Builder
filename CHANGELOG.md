# Changelog

Tous les changements notables du projet, en français. Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage sémantique. Ceci n'est **pas** encore un MVP : voir `Non-inclus` ci-dessous.

## [Non versionné]

### Ajouté

- **Le pont d'écriture directe (migration 0055)** : avis, commentaires et
  votes de commentaires sont écrits par l'app mobile en direct PostgREST —
  la base devient l'arbitre unique (CHECK, RLS own-row, garde trigger,
  grants par colonne) et pose les effets de bord (compteurs, score,
  notifications) pour le web comme pour le mobile. Écritures directes de
  `products` et `notifications` fermées aux clients. Contrat :
  `docs/mobile-ecritures-directes.md`.
- **La page `/guides/publier`** : le guide canonique de tout ce qui prépare
  une publication réussie (nom/tagline, captures, médias avant l'écriture,
  liens, texte, statuts de revue). Indexé, relié depuis `/guides` et depuis
  le formulaire de soumission.
- **Les jobs d'entretien** (`/api/cron/maintenance` + workflow samedi
  03:43 UTC) : purge notifications lues / OTP expirés / RSVP contacts,
  recount des téléchargements, sweep R2, dead man switch 26 h ; digest
  hebdo verrouillé en table (`digests_sent`, 0054) ; webhook Resend
  fail-closed (signature + fenêtre de replay 5 min) ; rate-limit IP sur
  la route legacy download ; sync revenue 503 iff total-fail.
- **La CSP est en Report-Only** (via `securityHeaders()` : HSTS,
  X-Frame-Options DENY, nosniff, referrer strict-origin-when-cross-origin,
  permissions-policy minimal) : rapports vers `/api/csp-report` (quota
  par IP, jamais bloquant pour le visiteur). Le flip en enforce attend la
  revue des reports.

- **Contrat mobile ecrit sur ce que l equipe code vraiment** : la forme
  d'ecriture des liens (31 champs multipart, PAS un objet `links` — un
  `links` JSON est ignore silencieusement), le mode merge explicite
  (absent = conserve, vide = efface), le comportement des revisions en
  attente (la table `product_revisions` est en deny-all : elle n'est pas
  lisible en direct), la reponse revenus (champs `arrCents`,
  `lastSyncedLabel`, `activeSubscribers`), le `GET /me/export` (absent
  du tableau) et le "/me/products = miroir dashboard" (faux : l'API v1
  n'expose ni vues, ni clics, ni rang, ni MRR, ni builds).
- **docs/data** : la table `product_revisions` (deny-all) et la regle
  miroir corrigee (une modif sensible d'une fiche publiee ne la fait plus
  repasser en `pending` : la fiche reste publiee, la modification
  attend un verdict).

- **La cle « Revenus verifies » du formulaire web est branchee** : elle partait dans
  la payload et n'etait JAMAIS lue (le formulaire passe par la route
  `/api/submit`, pas par la Server Action qui la lisait) → le maker
  collait sa cle Stripe, la validation passait, et rien ne se passait.
  Le probe echoue (ou le quota est atteint), le maker est prevenu.

- **La règle du produit du jour est en SQL ET en TypeScript, et elle est vérifiée** : le cron `pg_cron` (00:05) applique désormais la même priorité que le service TS (attente bornée à 7 j + signal borné à 7, l'attente pesant double) — avant, la fonction SQL enfilait les produits (FIFO) et c'était elle qui tournait en prod, pas la nouvelle règle. Un script dédié (`npm run verify:featured`) rejoue les DEUX moteurs sur le même état et compare leur choix : ils ne peuvent pas diverger silencieusement.
- **Outillage** : Chrome DevTools MCP déclaré dans la config opencode (console, réseau, traces de perf, et accès à ta session Chrome pour tester les écrans connectés). Zéro empreinte dans le produit.

- **Produit du jour : une priorité, pas une file d'attente** (l'algo du slot
  est réécrit ; le calcul est pur, donc testable hors base).
  Une seule règle, deux bornes, aucun seuil sur la taille du catalogue :

  ```
  attente(p)  = min(jours depuis la dernière mise en avant — ou depuis sa
                 publication si jamais mise en avant —, 7)
  signal(p)   = note moyenne + votes pondérés 7 j + 2 × commentaires 7 j
                 + 3 × avis 7 j
  priorité(p) = min(signal(p), 7) + 2 × attente(p)
  ```

  - l'attente bornée : elle ne cumule plus au-delà d'une semaine → la file ne
    peut pas grossir (le problème d'échelle) ;
  - le signal borné : un produit très voté ne peut pas monopoliser le slot ;
  - l'attente pèse double : celui qui n'a pas eu sa part l'emporte sur le bruyant.

  Conséquences : le slot n'est JAMAIS vide tant qu'un produit éligible existe ;
  l'ordre ne dépend plus de l'heure d'ajout ; personne n'est oublié et personne
  ne hoggue ; publier ou republier ne remet PAS l'attente à zéro (le slot
  n'est pas jouable). Les votes ne décident plus seuls : le produit du jour
  est une VITRINE, pas un classement (le classement, c'est le leaderboard).

- **Home : 12 cartes** au lieu de 9 sur « Fraîment shippé » et « Mises à jour
  récentes » (le catalogue fait 11 produits publiés : 9 en cachait 2 ; 12
  = 4 rangées de 3 sur desktop, tout le catalogue visible).

- **File des révisions** (admin) : les fiches publiées dont le
  contenu sensible (nom, tagline, description, liens, tags, requirements,
  commande d'installation) ou les médias ont été modifiés. Chaque
  ligne montre le diff (avant / après) et se tranche : appliquer ou
  refuser. Pastille admin + audit (`revision_approved` /
  `revision_rejected`, migration 0049).
- **Bandeau maker** : « une modification est en attente de revue » dans
  le formulaire d'édition — et le formulaire affiche les valeurs
  PROPOSEES (le maker ne voit pas disparaitre son texte).
- **Tuile « Binaires en revue »** dans le dashboard maker : le nombre de
  binaires en attente de verdict (le total était déjà là ; c'est
  l'attente qui manquait, pas le total).
- **Un seul point de vérification** (`npm run check`) : types, lint,
  format, les trois scripts de non-régression et le build de
  production, en une commande, lancée une fois par lot.

- **Liste complète des liens d'un produit** (doc mobile, §1-ter) :
  les 31 clés possibles du jsonb `products.links`, le bloc de liens
  par type de produit (le formulaire n'en propose qu'un sous-ensemble),
  et la règle « le jsonb ne contient que les liens renseignés ». La
  squad mobile lit `products` en direct (PostgREST) : elle avait les
  liens, mais pas la liste des clés possibles.
- **Non-régression binaire** (`verify-products-backend`, 180/0) : règle
  de version (refus si le code n'excède pas le build en ligne, un rejet
  ne verrouille plus le code), index partiel (le code d'un build rejeté
  est ré-insérable, deux builds vifs de même code sont refusés), écart
  d'identité (package / certificat), et liens en mode « merge ». Le
  script signale aussi les ids de liens **jamais vus en base** — un lien
  invisible, c'est un id à surveiller.
- **Purge des comptes de test** (`npm run verify:clean`) : les scripts
  de non-régression créent de vrais comptes (le submit exige un maker
  réel) ; un run interrompu laissait des comptes factices en base. Le
  script les purge, et la liste des users en admin n'affiche plus les
  comptes de fixture (domaine `example.com`, réservé par la RFC 2606).

- **9 cartes au lieu de 6** sur « Fraîtchement shippé » et « Mises à jour
  récentes » (3 rangées de 3) : 6 était une troncature invisible — le
  lien « Parcourir tout » ne menait pas au tri par récence, donc les
  mises à jour au-delà de 6 n'étaient atteignables nulle part. Ces liens
  pointent désormais vers le tri par récence (`/discover?sort=newest`).
- **Non-régression sécurité** (`scripts/verify-security.ts`, 16
  vérifications) : RLS activée sur toutes les tables, trigger
  `users_lock_sensitive` présent et activé, la clé anonyme ne lit rien sur
  les tables sensibles (users, revenus, audit, logs d'email, OTP), le rôle
  `authenticated` n'écrit que les colonnes de profil, et aucune fonction
  SECURITY DEFINER inattendue n'est grantée à `anon`. Ces protections
  sont invisibles dans le code applicatif : sans ce script, une nouvelle
  table sans RLS passerait inaperçue.
- **Privilèges d'écriture resserrés sur `users`** (migration 0046) : le
  rôle `authenticated` avait `UPDATE` sur les **22 colonnes** de la table — il
  pouvait donc écrire directement en base (PostgREST, clé anonyme publique +
  son JWT), en contournant toute la validation serveur (occupation hors
  vocabulaire, bio hors limite). Désormais, seules les 10 colonnes de profil
  restent écrivables — les colonnes sensibles étaient déjà protégées par le
  trigger (migration 0044), le rôle `authenticated` n'était pas concerné.
- **Page publique « Nouveautés »** (`/nouveautes`, lien dans la colonne
  « Le projet » du pied de page) : le journal daté de la plateforme, lisible
  par les visiteurs et indexable. Le contenu vit dans
  `content/nouveautes.json` — hors du code, donc modifiable et relisible
  sans toucher au composant.

- **Téléchargements APK (compteur réel)** : table `product_downloads`
  (événements anonymes — ni user_id, ni IP ; RLS deny-all) + colonne
  dénormalisée `products.download_count`, motif votes/commentaires. Un
  compteur par produit, pas par version (le chemin sert toujours le dernier
  build approuvé). Compté dans les deux routes de download (302 web et JSON
  natif) **après** les contrôles, en fire-and-forget : un 404 ne compte
  pas, l'écriture ne retarde jamais la réponse ; incrément atomique SQL,
  reconstruit depuis les événements par le job `scores`
  (`recountDownloadCounts`) — le compteur est un cache, jamais la vérité.
  Exposés côté maker (stat + 3ᵉ série du graphe d'activité, token violet
  `--chart-downloads` hors des familles de statut), côté admin (agrégat
  plateforme), et côté API v1 (`downloadCount` — parité, le mobile peut lire
  la colonne directement en base). Docs : `docs/data/product_downloads.md`,
  `docs/data/products.md`, `docs/mobile-contrats.md`. Migration 0045.
- **Guides « Signature APK » (hub + 6 fiches)** : `/guides/signature-apk`
  (schémas v1/v2/v3, keystore = identité, pourquoi la plateforme recommande les
  trois) + fiches A→Z autonomes Android natif, Flutter, React Native, Expo
  (EAS géré vs `credentials.json`, `eas credentials`, cas `expo prebuild`),
  Capacitor (`npx cap build` : `--signing-type apksigner`, le défaut
  `jarsigner` est v1-only) et « Vérifier & dépanner » (`apksigner verify
--print-certs`, refus plateforme décryptés, clé debug, keystore perdu,
  JKS→PKCS12). Contenu ancré sur les docs officielles (2026-10-17), logos
  officiels des frameworks (simple-icons), renvois `DocLayout` avec
  `logoDarkInvert`. Liens croisés : carte au hub `/guides`, footer (Explorer),
  note écran APK de soumission/update, FAQ sidebar, sitemap (7 URLs). Portes
  vertes tsc/eslint/prettier/build + `verify-apk-extract`.
- **Revenus vérifiés, finitions BÊTA** : slide-over « Quel prestataire ? »
  (soumission — 5 providers, format de clé, lien `#creer-la-cle`, choix
  direct) ; profil maker distingue vrai 0 en full (affiché) du masqué
  (`hasFull`, jamais « montant masqué » à tort) ; revue admin branchée sur
  la vue réelle (devise native, vrai label provider, mention « masqué au
  public ») ; stat admin « Clés revenus » (compte réel, fini « milestone
  revenue ») ; types admin élargis aux 5 providers ; home : section
  revenus rendue `null` si top vide (pas de CTA fantôme, `/revenue`
  porte son vide honnête).
- **Emails marque Mada-Made** : header = wordmark seul (~140 px, dual-img
  conservé, convention `mm_logo_*` vérifiée par pixels — suffixe = thème
  cible), table rase tuile + texte ; 26 occurrences « BuilderPlatform » →
  « Mada-Made » (12 fichiers, display seul).
- **Footer** : « Guides makers » (Explorer), « Signaler un problème »
  (`/issues/new`) + « Contribuer » (`CONTRIBUTING.md`) dans Le projet,
  copie digest corrigée (Mada-Made hebdomadaire).
- **Newsletter Phase 2** : cron `POST /api/cron/digest` (même garde
  Bearer que revenus, `?dryRun=1` pour contrôler sans envoyer) +
  workflow `digest-weekly.yml` (lundi 7 h Tana) ; audience Resend
  synchronisée depuis les inscrits (`services/newsletter.service.ts`,
  `run-jobs audience`, diff pur testé — ajouts dashboard conservés) ;
  webhook `contact.updated` → opt-out local ; `DigestForm` réservé aux
  membres (plus de champ fantôme) ; légal aligné sur le vrai contenu du
  digest ; runbook `docs/newsletter-operations.md`. Suite
  `verify-notifications` 24/24.
- **Veille internationale documentée** : section charte (ce que
  c'est, badge, hors jeu, retrait si équivalent local sans préavis) +
  clause opposable aux conditions (retrait ≠ sanction, pas de recours) ;
  `/confidentialite` inchangée (aucune donnée perso) ; +1 ligne
  contrats mobile. Bonus : emails de modération disaient « 4 règles »
  en n'en nommant que 3 — alignés sur les 5 réelles (+ assert suite).
- **FAILLE escalation clôturée (signalement équipe mobile, merci)** :
  `users_update_own` filtrait la ligne mais aucune colonne — tout client
  authentifié pouvait `SET role = 'admin'` (panel complet, la garde
  « vérité DB » contournée par construction). Trigger `BEFORE UPDATE`
  (migration 0044 + `setup.sql`) : `role`, `banned_at`, `email`,
  `username`, `providers` verrouillés sauf identités de service ;
  champs profil modifiables. Suite `verify-profile-backend` 23/23
  (escalade/slug/email refusés, bio OK). Bonus : teardown `$client`
  réparé (le Proxy liait le client postgres-js et perdait `.end()` —
  la suite sortait 1 malgré 0 échec).
- **Guides MRR corrigés** : chips providers avec logos (`DocLayout`
  `siblings.logo` + inversion dark, source unique
  `REVENUE_LOGO_DARK_INVERT`) ; table « Les 5 providers » en composant
  piloté par les specs (table markdown supprimée — fini la duplication
  des formats de clé) ; phrases de connexion réécrites au vrai chemin
  (hub + 5 fiches : submit/édition → « Détails techniques & modèle » →
  toggle) ; bloc « Déclinaisons » wordmark sur `/about` (polarité webp
  vérifiée par pixels).
- **`occupation` auteur avis/commentaires** : +1 colonne aux JOINs
  existants (`getProductReviews`, `getProductComments` — id brut, label
  via `GET /meta`, jamais d'email), web inchangé, contrats mobile à
  jour, suite étendue.
- **Footer digest honnête** : paragraphe consentement orphelin supprimé
  (décrivait un champ inexistant), CTA → `/settings` (« Gérer mes
  emails », le proxy gère le retour post-login — fini le détour
  dashboard incompréhensible).
- **Incident `/admin` instrumenté** : sonde jetable → toutes les
  dépendances data répondent (2,5 s max, aucune ne pend : le stream ne
  meurt pas d'une stat). Ajoutés : boundary `app/(admin)/error.tsx`
  (fini la boucle retry aveugle — page d'erreur stable + digest +
  Sentry), logs `[admin]` dev (gate, overview), compteur CTA borné 8 s
  (`-1` = bouton sans chiffre, jamais « (0) » mensonger).
- **Fan-out analytique réduit (cause du timeout 8 s)** : l'overview
  lançait 16+ requêtes concurrentes sur un pool à 10 slots — le mur des
  files d'attente, pas les tables. `getPageViewStats()` fusionne les 4
  compteurs `page_views` en 1 requête (FILTER, chiffres prouvés
  identiques aux comptages indépendants) ; fonctions unitaires
  supprimées (usage unique).
- **Admin indestructible par ses stats** : le stream `/admin` mourait en
  plein vol (retry navigateur en boucle) dès qu'une stat pendait — les
  compteurs vivaient dans le layout. Pastilles découplées : endpoint
  batché `GET /api/admin/badges` (`allSettled` par clé, contrat
  `{value, ok, at}` — un nombre ne s'affiche que sur `ok`, sinon « — »
  avec heure de tentative, jamais de 0 mensonger), shell en lazy
  (mount + changement de page + focus, retry auto des clés en échec
  seules ×2 espacés, puis stop silencieux — zéro re-clic), layout
  réduit au gate session+rôle. Suite `verify-admin-badges` 5/5.
- **Contact Phase 3** : migration 0043 (`contact_messages`, 5 motifs,
  statuts new/read/replied/archived, RLS deny-all, rétention 2 ans) ;
  page `/contact` indexable (Select partagé, honeypot, succès honnête «
  5 jours ouvrés ») + nav desktop/mobile débloquées ; inbox
  `/admin/contact` (file par statut, pastille `new`, réponse via client
  mail, message échappé) + email staff `contact-notify` ; mobile `POST
/api/v1/contact` (422 `VALIDATION`, jamais de 200 déguisé) ; légal
  (finalité + 2 ans) ; fiche `docs/data/contact_messages.md`. Suite
  `verify-contact` 16/16.
- **Hero makers mobile** : `GET /api/v1/makers?limit&sort` (`recent`
  par défaut — makers publiés, inscription récente ; `trending` — votes
  pondérés reçus sur 30 j glissants, `score` inclus = « + combien » ;
  `total` = vivier du tri, cache 60 s, rate-limit IP, 422 si tri
  inconnu). Même allowlist que le détail, bannis/supprimés exclus.
  Contrats en `docs/mobile-contrats.md`. Suite `verify-api-v1` 38/38.
- **Index docs rafraîchi** (`docs/README.md`) : les 35 fichiers classés
  vivant vs archive + règle « un nouveau `.md` = une ligne dans
  l'index ». Pas de plateforme docs façon Vercel : pas de lecteurs
  pour l'instant, le drift est le vrai problème, pas le format.
- **Préavis légal outillé** : le toggle settings pilote bien digest +
  audience (même `digest_opt_out`), mais aucun mécanisme ne prévenait la
  newsletter d'un changement de politique — promesse des 15 jours
  intenable. Ajouté : kind `legal_updated` (migration 0042),
  `announceLegalUpdate` (in-app + email direct à tous les membres actifs,
  opt-out ignoré = préavis contractuel), `run-jobs announce --doc
--summary --effective`, gabarit `legal-notice`, textes légaux alignés.
  Suite `verify-notifications` 26/26.
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
- **D1 builds APK** : table `product_builds` (migration 0033, historique,
  UNIQUE produit+version), bucket privé + presign PUT (quota 300 Mo,
  15 min) + GET signées, record `pending` avec preuves HEAD (taille
  menteuse/clé étrangère refusées + purge, jamais d'orphelin) ;
  `docs/data/product_builds.md` + contrats ; verify hardening 29/29.

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
- **Thread réponses** : coudes individuels en « L » par réponse
  (contraste renforcé, fini le rail continu qui « continuait » après la
  dernière réponse), clair/sombre.
- **Activité admin honnête** : approbation = « X (modération) a approuvé
  Y de Z » (l'admin n'est plus pris pour le maker, maker joint) ;
  rejet/retrait = motif seul (fini le nom dupliqué) + snapshot « … »
  si cible supprimée ; audits binaires résolus (« a approuvé/rejeté
  l'APK vN (C) de Produit », lien cockpit, pastille danger sur rejet) —
  fini les « → élément supprimé » ; `product_nudged` libellé.
- **SEO partage** : OG 1200×630 générées maker (`/og/m/…`), catégorie
  (`/og/c/…`), classement (`/og/leaderboard`, top 3 réel) + OG défaut
  site (`/og`) ; canonicals absolues leaderboard/discover/catégories
  (facettes = même canonical), `discover?q=` en noindex/follow.
- **Featured durci** : seuil des paliers sur catalogue éligible
  (`curated = false` côté TS + SQL `rotate_featured_daily`) + test de
  parité auto SQL↔TS (statique 4 gardes + dynamique même-gagnant ;
  a attrapé la fonction dev obsolète) (`verify-votes-ranking` 35/35) ;
  note seuils d'optimisation (`docs/featured-produit-du-jour-v1.md`).
- **Binaires APK D2–D6** : extraction locale 38/38 (package, version,
  icône, permissions), re-vérification SHA + Range avant mise en ligne,
  flow Update dédié (APK + notes, 1 pending max par produit),
  téléchargement direct (302 signé, QR, `downloadUrl` JSON-LD), section
  Mises à jour + badges « Mis à jour » 14 j, upload multipart resumable
  (parts 8 Mo, quota 300 Mo, offline-first + retry/reprise, watchdog),
  `download` interdit sur Android hors revue (matrice fiche×binaire 2×2,
  règle dans `/regles`), file + cockpit binaires admin (queue, cockpit
  `#binaire`, historique), RLS deny-all `product_builds`
  (`verify-apk-extract` 38/38, hardening 51/51).
- **Auth GitLab** : bouton + OAuth (scopes openid/profile/email/
  read_user), liaison multi-provider stricte (auto-link si email
  vérifié), mentions légales à jour.
- **Compte RGPD** : suppression avec purge réelle des objets
  (produits+médias+builds) + export ZIP immédiat (données, médias,
  builds tous statuts, appels, MANIFEST).
- **Recherche** : suggestions overlay (produits + makers + catégories,
  120 ms debounce, Alt+K, portail).
- **Images distantes** : allowlist centralisée (`lib/remote-images.ts`,
  R2 + GitLab + customs), avatars résilients (repli initiales).
- **Config requise en pastilles** : `requirements` passe de texte brut à
  `text[]` (miroir tags — Entrée pour ajouter, max 8 × 80, texte libre),
  migration 0038 + backfill (découpe retours ligne, zéro perte) ; fiche
  en liste, revue en ligne `·`, API v1 en tableau JSON (contrat mobile à
  jour — breaking `string` → `string[]`).
- **README** : lien code de conduite réparé (fragment brut), statut v1
  à jour (listings, leaderboard, APK, avis livrés — reste MRR), stack
  - GitLab, `db:setup` 64 instructions, carte docs (SECURITY, DESIGN,
    STACK, `docs/data/`).
- **Revenus vérifiés BÊTA (Phase 2)** : 5 adaptateurs (Stripe `rk_`,
  RevenueCat v2, Paddle metrics, Polar OAT, Lemon Squeezy — essais et
  impayés exclus partout, devise native jamais convertie), tables
  `revenue_connections`/`snapshots` (migrations 0039/0040, RLS deny-all),
  clés AES-256-GCM (jamais ré-affichées/loggées), sync horaire séquentielle
  (idempotente, `failing` à 2 échecs + notif + Sentry, cron Actions),
  bascule UI réelle (fiche, `/revenue` par devise, hero, dashboard, badges
  cartes), BÊTA sur submit/api/méthodologie, guides `/guides` indexables
  (hub + 5 fiches 2026 + deep-links), legal (clés 5 providers, clause bêta,
  fraude), mobile (`GET revenue`, `revenue-connections` ×3).

### Modifié

- **Le quota de captures passe de 6 à 8** (source de vérité au service, le
  composant de soumission suit) — Google Play plafonne à 8 screenshots ;
  le budget multipart monte à 92 Mo en proportion (`/api/v1/meta` expose
  déjà `productMaxBytes`, l'app mobile hérite). Le verify prouve le
  plafond : les 8 passent entièrement, le 9e est rejeté avant tout insert.
- **Le branding de la nav et du footer est un wordmark** (typographie
  définitive) ; les compteurs du hero restent branchés mais masqués tant
  que les chiffres honnêtes ne se sont pas établis ; le theme toggle est
  corrigé pour les lecteurs d'écran (aria-pressed, libellé stable).

### Corrigé

- **Les preuves d'appel survivaient à la suppression du compte** : les
  fichiers du bucket privé « appeals » sont purgés dans les DEUX chemins
  (action web `deleteMyAccount` et API mobile `DELETE /me`) — le contrat
  RGPD est tenu, aucune preuve orpheline.

- **Le mode d'ecriture des liens etait deduit de la payload** : une PATCH mobile
  avec seulement `changelogUrl` (aucun champ lien) tombait en mode
  « remplacement » → les liens de la fiche partaient avec, et la revision
  devenait INAPPROUVABLE (plus de point d'acces → regle violatee). Le
  mode est desormais decide par l'APPELANT (« replace » pour le web,
  « merge » pour l'API) : en merge, la base est toujours les liens de la
  fiche, moins ceux explicitement vidés.
- **L'ecriture etait partielle** : le patch de la fiche etait applique
  AVANT l'upload des medias → un echec R2 (indisponible, quota, format)
  laissait le texte a jour et la revision en file, alors que le maker
  avait vu une erreur. L'upload passe maintenant avant toute ecriture, et
  les ecritures (fiche + medias + revision) sont en une transaction.
- **Basculer l'orientation vidait la galerie PUBLIE** : la purge des
  captures de l'autre orientation partait a l'enregistrement, hors revue,
  et supprimait les objets R2 → la fiche en ligne se retrouvait a zero
  capture (definitivement si la revision etait refusee). L'orientation
  est desormais un champ SENSIBLE (elle part en revision) et la purge
  n'a lieu qu'a l'approbation.
- **Regression (corrigee) : un envoi d'APK pouvait REMPLACER le build en
  revue** → l'admin approuvait un binaire qui n'etait plus celui qu'il
  avait regarde, et le maker pouvait re-envoyer en boucle. Le garde-fou
  « un seul build en revue » est retabli (serveur + UI) : c'est lui qui
  protege la file ET l'integrite de la revue.

- **XSS stocké via le JSON-LD** (le seul vrai bloquant) : le JSON-LD était injecté avec `dangerouslySetInnerHTML({ __html: JSON.stringify(...) })` dans une balise `<script>` — or `JSON.stringify` n'échappe PAS `<` : une chaîne contenant `</script>` **ferme la balise** dans le parseur HTML et le reste est interprété comme du HTML. Le vecteur était sans revue : le `displayName` d'un maker (validé sur la longueur seule) et sa `bio` arrivaient dans le `personLd` de son profil public, indexable — un compte inscrit pouvait injecter du script et voler la session d'un staff qui visitait le profil. Un helper `safeJsonLd()` échappe `<`/`>`/`&` sur les 6 injections.
- **Le contenu NON VALIDé d'une fiche publiée était lisible par la clé anonyme publique** : la révision en attente vivait dans des colonnes de `products`, or le rôle `anon` a un GRANT de niveau TABLE sur `products` et la RLS ne filtre que les LIGNES → un `GET /rest/v1/products?select=pending_payload` renvoyait le texte en attente de validation (HTTP 200, vérifié). La révision part désormais dans SA table `product_revisions`, en déni-all (migration 0050) : `anon`/`authenticated` n'y ont plus accès du tout.
- **L'aperçu (`/preview`) montrait le contenu VALIDÉ, pas la révision en attente** : le maker voyait son ancien texte et croyait que son édition avait disparu. L'aperçu montre désormais ce qui sera publié (texte ET médias proposés).
- **La révision pouvait mélanger les médias de la v1 et le texte de la v2** : `pendingMedia` n'était jamais recalculé (les médias de la révision précédente restaient), et un refus purgeait des médias qui n'étaient plus ceux de la révision courante. Désormais la révision est fusionnée (un champ non touché garde sa valeur proposée, un champ remis à sa valeur validée sort de la révision) et les médias abandonnés sont purgés (R2).

- **Le produit du jour pouvait être vide** alors que le catalogue existait : l'algo
  enfilait les produits dans une FILE (jamais-featuré d'abord, puis
  moins-récemment-featuré, avec une fenêtre de 7 jours
  d'éligibilité). Les 3 produits éligibles étaient tous dans la fenêtre →
  plus aucun candidat → « Soyez le premier ». Deux autres
  conséquences : l'ordre dépendait de l'HEURE D'ARRIVÉE (la FIFO des
  ajouts — à l'échelle, le dernier publié attendait des semaines), et la
  fenêtre était un seuil figé à recalculer à chaque changement de taille
  du catalogue.
- **Check de pagination rendu fragile** (`verify-products-backend`) : il
  exigeait que ses 3 produits de test tiennent dans les 2 pages du flux
  — une publication staff intercalée entre-temps le faisait échouer à tort
  (la pagination keyset, elle, était correcte). Le check vérifie
  maintenant la CONTINUITÉ de l'ordre, pas la position des fixtures.

- **Les compteurs de catégories ne tenaient pas compte des sous-catégories** : ils
  ne comptaient que la catégorie PRINCIPALE, alors que la page
  `/categories/[slug]` liste les produits dont le tableau `categories`
  CONTIENT la catégorie (comme le filtre du flux). Le compteur annonçait
  « 1 produit » sur une page qui en listait 7. Le compteur compte désormais
  TOUTES les catégories d'un produit — même règle partout (hero
  compris, qui se re-classe sur les mêmes chiffres que la page).

- **Une fiche publiée disparut du site a chaque retouche** : le
  nom et les liens modifiaient le statut en `pending` → la fiche n'était
  plus servie publiquement (`fetchProductBySlug` ne sert que les
  `published`) jusqu'à l'approbation. La règle des stores est
  appliquée : la fiche reste en ligne avec son contenu VALIDÉ, et la
  modification attend un regard admin (colonnes `pending_*`, migration
  0048). Les changements ne filent pas : tant que l'admin n'a pas
  validé, le public voit l'ancien contenu.
- **Le logo et les captures d'une fiche publiée étaient remplacés
  sans revue** : ils partaient directement en base. Même traitement que
  le texte : ils attendent la validation, dans la même révision.
- **Les règles de la fiche étaient contournables** :
  `assertLinkRules` n'était rejoué QUE si les liens changeaient. Un
  produit publié pouvait donc passer en `subscription`, en `android` ou
  en audience `enfants` sans revalidation → politique de confidentialité,
  sécurité enfants ou téléchargement direct banni
  contournés. Les règles sont rejouées désormais à chaque
  édition d'une fiche en ligne, sur la fiche effective.
- **Les produits en veille affichaient un vote impossible** : le bouton
  était désactivé mais le COMPTE restait visible, et la pastille
  de vélocité ("+N votes aujourd'hui") s'affichait aussi (flux,
  recherche, catégories, fiche produit). Un produit hors classement ne
  se vote pas : ni bouton, ni compte, ni vélocité — le badge
  « Veille » en tient lieu.
- **Les boutons de vote de la home « Mises à jour récentes » ne
  savaient pas si l'utilisateur avait voté** : les états de vote
  n'étaient pas propagés à cette section (la home récupérait
  déjà les ids mais ne les passait pas) → un utilisateur ayant
  voté voyait « pas voté ». L'aperçu (`/preview`) forçait
  aussi `initialVoted: false`.

- **Un APK re-soumis après un rejet était refusé** : la référence
  de version était le MAX de tous les builds, rejet compris — un build
  rejeté n'ayant jamais été distribué, il brûlait son `versionCode` pour
  un rejet réparable (le motif de rejet dit pourtant « corrigez et
  re-soumettre »), et le maker devait bumper son APK pour une simple
  correction de notes. La référence est désormais le build **EN LIGNE**
  (approuvé) : c'est lui que l'utilisateur a installé. Même règle côté
  client (la page Update affichait « doit être supérieur à 3 » alors que
  le build en ligne était le 2).
- **Un APK d'une autre application pouvait être publié** : rien ne
  comparait le fichieruploadé au build en ligne — ni le certificat, ni le
  package. Un fichier d'une autre app se parse, se signe et s'affiche
  parfaitement : seul son `package` le distingue. La fiche de revue
  affiche désormais l'écart (package différent = « Autre app », en rouge,
  avec le build en ligne en regard ; certificat différent = rotation de
  clé, signal d'alerte que l'admin tranche).
- **Un envoi est refusé tant qu'un build est en revue** (garde anti-spam ET intégrité de la revue) : un envoi qui REMPLAÇAIT le build en revue ferait approuver à l'admin un binaire qui n'est plus celui qu'il a regardé, et le maker pourrait ré-envoyer en boucle. La sortie de secours est le verdict : refusé par l'admin, le maker renvoie (et le même versionCode est réutilisable — l'index unique est partiel).
- **L'index unique des builds interdisait la re-soumission** (migration 0047) : `(produit, version_code)` était unique SANS condition, donc
  la ligne d'un build rejeté gardait son numéro de version définitivement.
  L'index est désormais **partiel** (`pending`/`approved`) : un rejet
  ne verrouille plus la version, mais deux builds vifs de même code
  restent impossibles.
- **La touche Entrée dans un champ enregistrait un brouillon** : le
  bouton « Enregistrer le brouillon » était le premier `type="submit"`
  du formulaire, donc la soumission implicite du navigateur déclenchait
  son clic. Il est passé en `type="button"` (il soumet lui-même), et
  l'intention est consommée à la lecture — la validation client
  échouant, elle restait en place et l'appui suivant rejouait
  « publier ».
- **L'API mobile effaçait les liens non renvoyés** : le serveur
  remplaçait la totalité des liens de la fiche par ceux de la payload,
  alors que le mobile n'envoie que les champs qu'il modifie. Le mode
  « merge » fait la distinction : absent = **conservé**, champ vidé =
  **effacé**. Le web garde son remplacement total (il envoie tous les
  champs) — résultat identique, aucun changement de payload côté
  mobile.

- **Le classement affichait des nombres qui ne correspondaient pas à l'ordre**
  : les fenêtres « Cette semaine » et « Ce mois » ordonnaient par `score`
  (décroissance temporelle) mais affichaient le total de votes du produit —
  on obtenait un podium « 2, 3, 1 » impossible à retrouver. Le rang est
  désormais **le nombre de votes reçus dans la fenêtre**, et c'est ce
  nombre que la pastille affiche (« 12 votes cette semaine »). La fenêtre
  « Aujourd'hui » est alignée sur la même règle, et la fenêtre « Tout le
  temps » reste classée sur le total (déjà visible sur le bouton de vote).
  Le classement taxonomique (par poids, hors chronologie) n'est pas touché.
- **Les compteurs de `/categories` étaient des mocks** : la page annonçait
  « 691 produits » alors que la base en compte 11, et listait des catégories
  sans aucun produit. Les compteurs sont maintenant **comptés en base**
  (`services/catalog-counts.service.ts`) ; les entrées vides sont masquées,
  et la page assume le chiffre réel (« le catalogue démarre »). Repli sur
  les compteurs de config si la base est injoignable.
- **La home bascule de fenêtre sur le nombre d'items** : une fenêtre qui
  sort des produits mais aucun vote affichait un classement mort. Le
  basculement se fait désormais sur l'activité en votes.
- **La page de mise à jour d'un binaire demandait les notes de version dans
  le contexte du formulaire de création** (`useSubmitForm`) : la page
  plantait à l'ouverture. Les notes sont désormais des props de la section
  APK, avec un champ obligatoire clair quand le fichier est déjà en ligne.
- **La description longue d'une fiche débordait** : elle est désormais
  repliée sur 700 caractères, avec un dégradé et un « Voir plus / Voir
  moins » — le reste de la fiche reste visible.
- **Le type de produit ne verrouille plus l'orientation des captures** : le
  type ne fait plus que _suggérer_ une orientation, le maker peut la changer
  librement, et la bascule prévient quand elle emporte des captures de
  l'autre format.

- **Les fiches produit plantaient sur les produits à sous-catégories** : le
  complément des produits similaires écartait les ids déjà vus avec un
  `ANY()` artisanal — avec un seul élément, le tableau part en scalaire et
  Postgres refuse (« cannot cast type uuid to uuid[] »). Remplacé par
  `notInArray`, qui gère le binding.
- **Le compte à profil était bloqué (« Champs invalides. »)** : une bio
  de 278 caractères (la limite était 160) était renvoyée telle quelle à
  chaque sauvegarde — impossible de changer son nom ou son occupation sans
  raccourcir sa bio à la main. Bio portée à **400 caractères** (colonne
  `text`, aucune migration) avec un compteur live ; le profil débloqué l'est
  désormais.
- **L'avatar restait en placeholder jusqu'au refresh** : le preview local est une
  URL `blob:`, que l'optimiseur d'images ne sait pas traiter ni allowlister — il
  rendait le placeholder. Et ce preview gardait la priorité sur l'URL déjà
  uploadée, donc l'image non recadrée était affichée. Les sources
  locales passent maintenant par un `<img>` simple, et l'URL serveur (cadrée,
  persistée) prend le relais dès l'upload réussi.
- **La carte écrasait le nom du produit** : le badge version + date était planté
  dans la rangée du titre (avec le badge Veille) — le nom débordait. La version
  et la date passent sur une **ligne dédiée sous le titre**, en texte simple
  (plus de pastille), et les séparateurs de la ligne technique sont
  intercalés entre les segments présents (plus de point orphelin).
- **Les cartes n'affichaient que 3 plateformes** (web / iOS / Android codées en
  dur) : les 5 autres étaient invisibles. Elles passent par la configuration,
  comme le reste du site.

- Téléchargements APK : URL native sans cache partagé, écritures suivies après
  réponse via `after()` et vérification du compteur sans temporisation. Les
  rafraîchissements des pastilles admin ignorent les réponses dépassées.
- **Pastilles admin (« En revue », « Binaires ») qui restaient à 0/nulle** :
  deadlock du shell — le ref `inFlight`, partagé entre les effets,
  sortait immédiatement quand une navigation arrivait pendant le fetch
  (`run()` rend la main avant que `inFlight` soit remis à false, et le
  `merge` de l'effet abandonné était neutralisé par `cancelled`) ; les
  compteurs n'étaient donc jamais fusionnés et la pastille restait
  absente — lue « file vide ». Effet réécrit : plus de ref partagé,
  `AbortController` par instance, attentes de retry résolues au cleanup.
  Durcissement dans la foulée : une erreur de compteur ne se change plus
  en `0` confirmé (`.catch(() => 0)` retiré de `getPendingCountCached` /
  `getRejectedCountCached` → `ok: false` → pastille « — »), délai de 8 s par
  compteur (un compteur lent ne retient plus tout le lot), rôle illisible =
  **503 tracé** côté Sentry au lieu d'un 403 muet, et motif HTTP affiché
  dans l'infobulle (401 session / 403 rôle / 503 backend).
- **Logo du produit du jour** : `iconUrl` n'existait pas dans
  `FeaturedProductData` et n'était pas recopié par `toFeaturedCard` —
  alors que la requête le sélectionnait déjà. La tuile d'initiales était le
  seul rendu possible, logo absent sur la home et `/leaderboard` pendant
  qu'il s'affichait partout ailleurs. Champ ajouté au type + mapping, et
  rendu image avec repli initiales aligné sur `ProductCard`.
- **Hero catégories figé** : les slots venaient d'une liste éditoriale de 7
  domaines, donc une catégorie ajoutée au catalogue plus tard ne pouvait
  pas y remonter (cas `meteo`), les slots restants se remplissant de 0. Le
  tri porte maintenant sur toutes les catégories par compte réel, le rang
  éditorial ne servant qu'au départage ; `HERO_CATEGORIES` reste la source
  du fallback sans données.
- **OG `/og/leaderboard`** : le div des noms avait deux enfants, ce que
  Satori refuse — l'erreur n'apparaissait qu'au premier classement non vide
  (jamais en CI sans données). Rang et nom fusionnés en un seul texte.

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
