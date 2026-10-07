# Milestone Products — plan d'exécution (V1, sans MRR)

> Lancement réel : 3 produits fondateur + ~10 invités. Pas de seeding
> de masse (décision) — le script seed ne sert qu'au dev.
> Avis/commentaires utilisateurs : exclus (V1.5). MRR : boss final, plus tard.
> Buckets médias : **Cloudflare R2** (pas Supabase Storage).
> Jobs : **pg_cron seul** (GitHub Actions en réserve documentée).
> Catégories : **slugs statiques** (config, validés Zod — pas de table).
> Draft : **inclus** (`draft` dans les statuts).
> Règle d'or : pages fines → services → db. Jamais de SQL ni de secrets
> dans `app/`/`components/`. Aucun commit/push sans ordre explicite.

## Phase 1 — Modèle & socle lecture [FAIT]

- [x] `db/schema/products.ts` (+ migrations `0013/0014/0015`, appliquées ;
      `0012` abandonnée — voir git)
- [x] RLS `setup.sql` §6 (41/41 appliqué)
- [x] `lib/r2.ts` + `scripts/r2-setup.ts` (buckets existants, convention
      `R2_PUBLIC_BASE` + repli `R2_PUBLIC_URL` déjà en place)
- [x] `scripts/seed-products.ts` (40 dev, compte seed, refus prod,
      `gallery_orientation` pilotée par type)
- [x] `scripts/verify-products-backend.ts` (29/29 : CRUD, slug unique,
      shots ordonnés, vote unique + compteur, vues, R2 put/delete,
      nettoyage + pipeline images + porte d'orientation + submit fichiers)
- [x] `.env.example` (vars R2)
- [x] Liens JSONB `Record<field-id, URL>` (whitelist matrice, 0 migration
      par nouveau lien) — remplace les 8 colonnes du plan initial
      (collisions ex. Flathub/Steam) ; `changelogUrl` fusionné dans
      `links.changelog`
- [x] Migration `0016` : `products.gallery_orientation` +
      `product_screenshots.{orientation,width,height}`
- [ ] Mobile : rien (phases suivantes)

- [ ] `db/schema/products.ts` : tous champs §8 (slug unique, maker_id,
      tagline ≤100, description markdown, category slug texte, platforms
      text[], 8 colonnes liens, product_type enum 15 valeurs + game,
      pricing_model enum, license, flags ads/IAP/enfant, install_command,
      version, changelog_url, target_countries[], languages_supported[],
      gallery_urls (legacy) + table screenshots, status
      `draft|pending|published|rejected` + rejection_reason, compteurs
      dénormalisés (upvote_count, score), published_at/created/updated/deleted.
- [ ] `product_screenshots` (product_id, url R2, position, caption).
- [ ] `votes` (user_id, product_id, weight défaut 1, UNIQUE(user,product)).
- [ ] `product_page_views` (path+instant, anonyme — même pattern que
      `page_views`, jamais de user_id).
- [ ] Validation : category slug contre `config/categories` (Zod, pas de
      CHECK DB — la config est la source unique), product_type aligné
      `config/product-types` (+ `game`).
- [ ] `lib/r2.ts` : client S3 lazy (endpoint R2, clés serveur seules),
      buckets `product-logos`, `product-shots`, Cache-Control immutable,
      content-type depuis magic-bytes (pipeline existante). Env `R2_*`
      documentées dans `.env.example`. Domaine custom en prod, `r2.dev` dev.
- [ ] RLS (`setup.sql`) : lecture publique `published` uniquement ;
      `pending`/`draft` = auteur + staff ; écritures = service (deny-all
      via API, comme appeals). UPDATE/DELETE : auteur (draft/pending) ou
      staff ; published : auteur sauf nom/liens (re-revue).
- [ ] `scripts/seed-products.ts` : catalogue mock → dev uniquement
      (compte seed "Équipe", **refus en prod sans `--prod --i-know`** —
      jamais de fausses données en prod).
- [ ] Migration `0012` + `verify-products-backend.ts` (CRUD + RLS + R2
      put/get/delete de test + nettoyage).
- [ ] Mobile : rien (lecture aux phases suivantes).

## Phase 2 — Submit réel + revue + dashboard [FAIT]

- [x] Submit : Server Action (Zod complet depuis matrice liens + checker
      serveur + uploads R2 + `draft`/`pending`), édits (nom/liens → re-revue,
      draft libre, published : textes directs). `links` persisté (bug
      bloquant corrigé), clés R2 toujours `.webp`, quota **6** captures.
- [x] Médias — pilotage auto par type (`config/product-types.orientation` :
      `app_mobile` = portrait, desktop/web/saas/cli/… = paysage,
      `game`/`bot`/`other` = toggle actif) ; uniformité par fiche imposée
      (intrus rejeté, jamais recadré/mélangé) ; logo `contain` transparent
      256px min ; captures `inside` ratio préservé, 400px min, côté long
      ≤1600 ; pré-check dimensions navigateur + DataTransfer (les fichiers
      sélectionnés partent réellement au serveur).
- [x] Galerie fiche (`ProductGallery`) : props réels + état vide de
      première classe, slots uniformes par orientation, `object-contain`.
- [x] Revue admin branchée DB : file (`getReviewQueueList` + `toReviewItem`,
      SLA 24 h, file vide honnête) + détail `[id]` (`fetchReviewItem` :
      captures réelles, identité maker, compteurs en ligne/bans) ;
      approve/reject + emails ; suppression manuelle.
- [x] Dashboard maker branché DB : overview (`fetchMyProducts` →
      `toDashboardApp`, brouillons exclus), brouillons vivants
      (`/dashboard/drafts` + `?edit=` pré-rempli complet), suppression
      RGPD confirmée (overview + brouillons).
- [x] Mobile : `POST /api/v1/products`, `PATCH /[id]`,
      `GET /me/products` (multipart, même contrat que le web, enveloppe
      `{ok,data}`) + `docs/mobile-contrats.md`.

## Phase 3 — Votes + leaderboard + featured [FAIT]

- [x] `toggleVote` : 1/user, réversible, optimiste + réconcilié (bouton
      unique), `weight` 0 si compte < 24 h (shadow, `counted` transparent),
      refus < 1 h, banni refusé, self-vote autorisé (décision), rate-limit
      compte (30/min) + IP large (300/min, NAT MG) fail-open, recompte
      `COUNT` en transaction (m16 : jamais d'incrément), rescore immédiat.
      Mur auth + vote en attente rejoué au retour (§15, replayer layout).
- [x] Leaderboard onglets depuis DB (formule §11 : `w/(h+2)^1.5`, today en
      votes pondérés + `published_at` asc, all-time en `upvote_count`) +
      page serveur (SEO) ; home branchée (top 5 + total réel).
- [x] **Featured à volume variable** : top (#1 d'hier) → rotation
      (re-feature 7 j) → dernier publié → jamais vide (« soyez le
      premier ») ; override admin (épingle/lève, audit `product_featured`) ;
      job quotidien idempotent + lazy (panne cron couverte).
- [x] Discover/newest en parité : contrat `discover-filters` réutilisé
      (tri dans l'URL, debounced), `q` en `ilike` intérim (tsvector Phase 4),
      sorts morts masqués (comments V1.5, MRR) ; catégories branchées DB.
- [x] Jobs pg_cron (setup.sql §7 gardé : score 15 min, featured quotidien,
      purge mensuelle) + `scripts/run-jobs.ts` (dev/manuel) + balayeur
      d'orphelins R2.
- [x] Mobile : `POST /api/v1/products/[id]/vote` (+ contrats).
- [x] Go-live honnête : compteurs seed remis à zéro (migration `0018`,
      seed futur à 0) ; `verify-votes-ranking` 28/28 (makers dédiés,
      comptes antidatés, paliers featured à dates injectées).

## Phase 4 — Découverte & stats [EN COURS — lots 4A + 4A-bis faits]

- [x] Fiche DB + SEO (4A) : page `[slug]` 100 % DB (header, galerie,
      vidéo, description, sidebar, related même catégorie), tableau
      « Configuration requise » + changelog quand fournis, related liés,
      JSON-LD `SoftwareApplication`, metadata + canonical + OG/Twitter
      de base, `notFound` hors published, vues anonymes (`after`), clics
      sortants anonymes (beacon `POST /api/v1/beacon/click` + table
      `product_link_clicks`, migration `0020`), CTA principal en nouvel
      onglet. Avis/commentaires mocks conservés (décision).
- [x] Cohérence submit ↔ fiche (4A-bis) : section « Marchés & langues »
      (tokenisé, espace ≠ commit, pré-rempli en édition), fiche +2
      MetaRows (Pays cibles, Langues) + indicateur Partage de données,
      fix édition (champs enfin modifiables), roundtrip testé offline.
- [x] Recherche plein texte (4B) : tsvector FR pondéré (nom > tagline >
      description, colonne GENERATED + index GIN, migration `0023`) +
      fallback trigram (fautes de frappe), `q` classé par pertinence
      (tri demandé en départage).
- [x] Sitemap dynamique + robots (4B) : produits, catégories, makers,
      statiques ; `Disallow` dashboard/settings/admin/api (+ search
      défensif) ; `NEXT_PUBLIC_SITE_URL` requis en prod.
- [x] SEO-max : RLS ré-appliqué + sonde anon (tables sensibles fermées,
      publiés lisibles), `metadataBase` + canonical absolue, twitter
      large, JSON-LD honnête (zéro note — avis mocks, réouvert V1.5),
      fil d'Ariane, OG générées `/og/[slug]` (hors `/api/`, robots-safe),
      ItemList discover/catégories/leaderboard.
- [x] Profils makers publics (4C) : identité + produits publiés
      (ProductCard, votes initiaux) + totaux réels (produits, votes
      reçus) ; metadata SEO (canonical absolue, OG avatar, ProfilePage +
      ItemList) ; chemin démo supprimé (réel ou 404) ; vues privées,
      MRR phase revenus.
- [x] Stats dashboard maker (4C) : vues + clics sortants réels par
      produit et totaux (engagement batch, 2 requêtes) ; carte Clics ;
      deltas honnêtes (fin des faux « +18 cette semaine »).
- [x] Mobile (4D) : `GET /api/v1/products` (nouveautés keyset +
      recherche pertinence + pages, filtres partagés web/mobile via
      `buildDiscoverConditions`) et `GET /[id|slug]` (fiche complète +
      `voted` si Bearer, 404 sinon) ; cache public court, rate-limit IP.
- [x] Lots admin/stats (post-4D) : badge « En revue » réel + table
      produits DB (recherche/filtre, suppression motif requis, liens
      slug) + strip plateforme exhaustif (15 cartes : produits par
      statut, upvotes, vues/clics total + 7 j, comptes, emails, notes
      0 + Phase 5, MRR « — ») + activité réelle (audit + soumissions +
      inscriptions, zéro faux événement) ; maker : CTR, rang top 15,
      vues 7 j (delta réel), état notif email ; emails `email_logs` +
      webhooks Resend (delivered/bounced/complained, opened/clicked
      ignorés §16) ; submit médias : slot masqué à 6/6, grille unifiée ;
      cloche notifs réelle (emails maker, sans pastille V1.5) ;
      connexions revenus en vide honnête (pas de table) ; audit zéro
      mock rendu (fallbacks sans-backend conservés, données mortes
      à purger).
- [x] Avis + commentaires : tables (`UNIQUE` user/produit, thread 1
      niveau, votes +1/-1 toggle), note 1-5 + texte requis, réponse
      maker unique officielle, soft delete + modération staff (audit
      `review_removed`/`comment_removed`), compteurs dénormalisés
      (recompte exact), fiche réelle (moyenne + distribution + thread),
      notes sur cartes/discover/makers/dashboard, `aggregateRating`
      JSON-LD (enfin réel), API mobile + contrats.
- [x] Notifications temps réel : table (`kind` 12, `read_at`, textes
      pré-rendus, index idempotence milestones), émission partout
      (revue, modération, rôles, appels, avis/comments reçus — jamais
      à soi-même, milestones votes/vues seuils fixes), digest hebdo
      (template, opt-out profil, run-jobs) ; cloche (pastille réelle) + page `/dashboard/notifications` + watcher Realtime (toast +
      refresh, RLS own) ; mobile `GET/PATCH /me/notifications` ;
      purge 90 j.
- [x] Import README : pipeline partagée (emojis/badges/HTML→markdown/
      images/relatifs/espaces/cap, idempotente) × 3 sources (dropzone
      fichier, coller, URL repo main→master SSRF-safe) → pré-remplit
      l'éditeur ; remark-gfm (tables/strike/task-lists, tables HTML →
      vraies tables) ; Prose `img` durci (no-referrer + hide) ;
      sanitize serveur.
- [x] Curation OSS : flag `curated` (migration 0029, auto par compte +
      toggle admin), purge seeds (40 produits + equipe@), badge Veille,
      exclu leaderboard/featured, votes + avis désactivés (commentaires
      ouverts), compte `open-sources` (user + clause), licence SPDX-only.
- [x] Tagline 220 (title SEO nom seul, OG tronquée) ; App Web orientation
      libre (défaut paysage, pré-remplie en édition, contrats à jour).
- [x] Vote-gate : code machine `account_too_young`, clause anti-triche
      /conditions, dialogue web (refus + 1er poids 0), contrat mobile §9.
- [x] Vote loyal expliqué partout : dialogue réécrit court/chaleureux sur
      shared `ConfirmDialog` (`hideCancel`, `vote-gate-dialog.tsx`
      supprimé), lien → `/regles` d'abord (la charte renvoie aux
      conditions), règle « Des votes loyaux » enrichie, section
      « Le saviez-vous ? » sidebar submit.
- [x] Curation mobile : `isCuration` dans `GET /makers/[username]`,
      lecture directe voie première documentée (contrats §1-bis,
      `docs/data/products.md`), zéro endpoint ajouté.
- [x] Faille shadow-weighting corrigée : `weight` figé à l'INSERT →
      promotion 0→1 des comptes devenus majeurs dans le sweep 15 min
      (TS + SQL prod, bannis exclus), check verify 3-bis.
- [x] Hygiène tests : 6 comptes factices purgés (DB + Auth), 3 scripts
      qui fuyaient corrigés (otp-mobile, products-backend, profile),
      faux compteur « 691 produits » remplacé par du réel.
- [x] Licence : `accept` retiré (LICENSE sans extension), conversion
      URL page → raw (GitHub/GitLab), UI refonte standard README.
- [x] Sport ajoutée aux catégories atomiques + famille Quotidien
      (36 catégories) ; hero top 7 dynamique par counts réels.
- [x] Bug R2 (`r2KeyFromUrl` amputait la clé → orphelins silencieux)
      corrigé + section 13 verify médias-édition (119/119).
- [x] Faille stale-JWT (demoted garde l'accès panel) : miroir re-syncé,
      layout = vérité DB, `syncRoleMirror()` partagé ; home anti-crash ;
      logos réels dashboard + file review.
- [x] Empty states unifiés (14 → `EmptyState`, admin sobre, galerie exclue).
- [x] Digest → `/settings` (switch immédiat, reset-save éliminé), fix
      save-occupation, `PATCH /me/preferences` + docs mobile.
- [x] Re-soumission après rejet (retour en file, sans doublon, prouvé),
      redirect auto post-verdict + redirect file vs 404, dashboard
      anti-crash, vrais chiffres avis (`getFeedbackStats`).
- [x] Section Rejetés (variante `ReviewQueue`, rappel + cooldown 3 j +
      audit, template `product-nudge` testé 121/121) ; visuels réels
      activité + notifications (cloche + page + contrat mobile).
- [x] Fiche admin en markdown (`Prose`) ; dashboard maker réorganisé
      (section « Mes produits » dédiée, overview = stats + futurs graphes).

## Phase D — `submitted_at` + binaires APK (décisions verrouillées)

**Règle métier** : 1er submit (android) = APK fortement recommandé + bannière
anti-oubli si skippé (non bloquant). Track binaire dès 1 build : Update
exige APK + notes **seulement si la track existe**. Edit = infos existantes
(lock binaire si build existe, rattrapage autorisé sinon — même pipeline,
re-revue auto, badge admin « Binaire ajouté via édition », CTA dashboard
« Ajouter le binaire »). Boutons Edit/Update séparés au dashboard.

- **D0** : `submitted_at` (migration 0031, écriture submit/update/resubmit/
  re-revue, lecture `toReviewItem` + tri file, backfill `updated_at`, schéma
  Drizzle + `docs/data/products.md` ; resubmit = nouveau cycle)
  — FAIT (verify 122/122, section 13-bis SLA).
- **D1** : table `product_builds` (historique complet, rollback possible),
  quota **250 Mo**, upload direct R2 présigné (jamais via Vercel),
  **pinning certificat strict dès D1** (update autre certificat = refus),
  **revue binaire bloquante** avant publication. APK universel only
  (splits refusés avec doc ; AAB refusé avec doc — conversion = clé maker).
- **D2** : bloc first-upload submit (conditionnel `android`, recommandé +
  bannière) + extraction cliente (manifest + cert, tableau Play) ;
  robustesse : corpus 15-20 APK, face-à-face libs, vendoring pinné,
  fixtures verify, vérif serveur par Range (`app-info-parser` vs
  `reiko-parser` à départager aux tests).
- **D3** : parse manifest côté client à l'upload (package, versions,
  minSdk warning seul, permissions, label, icône) + SHA-256/taille +
  scan malware minimal.
- **D4** : flow **Update** (bouton dashboard séparé, page dédiée,
  versionCode strictement supérieur, pinning, notes **1000 signes**
  requises si track) + **revue binaire bloquante** admin ;
  install = job mobile (un tap, comme Aptoide) — APK only.
- **D5** : fiche (bloc Télécharger + QR PC→téléphone + historique versions
  - notes dynamiques par build ; download = dernier build revu).
- **D6** : home « Mises à jour récentes » + badge discovery **14 j** +
  gestion builds dashboard.
- [x] Hybride mobile : OTP email (2 endpoints session JSON, stateless),
      docs data par table (`docs/data`, 20 fiches relues schéma/RLS),
      RLS lecture (screenshots/reviews/comments/comment_votes, fix
      `featured_products` ouverte), lectures directes / écritures API.

## Phase 5 — Signalement & modération [À FAIRE]

- Bouton « Signaler » du sidebar fiche (aujourd'hui mort) : dialogue
  (motifs fermés + note si « autre »), auth requise comme le vote.
- Table `product_reports` (FK cascade maker+produit, motif fermé, note
  ≤500, `UNIQUE(user,product)`), RLS insert auteur / lecture staff.
- Compteur + motifs dans la file admin, tri par signalements.
- Règles : 1 signalement/user/produit (doublon = CONFLICT franc),
  **aucune action auto** (pas de dépublication sur seuil), maker non
  notifié (anti-représailles).
- Motifs : spam · liens morts ou trompeurs · contenu trompeur ·
  interdit ou offensant · autre (note requise).

## Phase 6 — API hardening large [FAIT]

> Qualité/robustesse/scalabilité de TOUTE l'API, quel que soit le trafic
> actuel. Scope mobile : lecture + vote (+ reviews/comments V1.5/Phase 5),
> soumission web-first en pratique — endpoints submit/edit/presign
> CONSERVÉS (décision : garder au cas où, pas de suppression).
> Transports : REST pull + cache (base), polling conditionnel/SSE/Realtime
> en évolutions si besoin sub-seconde prouvé (aucun aujourd'hui).

- [x] Idempotence POST : header `Idempotency-Key` (submit products, vote),
      table + TTL 24 h, réponse rejouée à l'identique (réseaux MG).
- [x] Garde taille multipart : `Content-Length` → 413 avant buffering
      (jamais 60 Mo en RAM).
- [x] Cache HTTP lectures : `s-maxage` + `stale-while-revalidate` par
      fraîcheur (makers 60 s, meta 1 h) ; privé = `no-store` explicite.
- [x] Pagination : curseur keyset (helper partagé) sur `GET /me/products`
      (limit 1–50, défaut 20) + index composite ; offset conservé pour
      les pages numérotées web.
- [x] Uploads R2 présignés : staging `staging/{maker}/{uuid}.webp`
      (size+type vérifiés avant signature), submit par clés (pipeline
      intacte : download R2 → validation → final → purge staging),
      sweeper staging > 24 h. Multipart direct conservé (web).
- [x] JWT local : vérification signature sans roundtrip Auth, repli
      distant à l'échec (jamais de refus sur incident vérif).
- [x] Contrats `mobile-contrats.md` : idempotence, presign, cache,
      curseurs, points de refetch (launch/focus/pull/post-vote).

## Transverse (chaque phase)

RLS, `verify-*`, `tsc` + eslint zéro + prettier + build, docs +
CHANGELOG (Non versionné). Commits/push/PR : ordres explicites uniquement.
Pages staff/perso : `force-dynamic` (jamais de pré-rendu statique sans
session — review phases 1+2). Review + correctifs : `docs/reviews/phase1-2.md`
(3 bloquants + 10 majeurs corrigés, vérifié 60/60).
Polish pré-Phase 4 : tags tokenisés (espace = badge), sidebar « Lire les
règles » → `/regles`, privacy requise si monétisé (serveur + test).
Stabilisation pré-Phase 4 : crash `VALID_WINDOWS` (valeurs partagées via
module client — règle : jamais), cadre facettes harmonisé, voile de
chargement global (transitions), `EmptyState` global (dotLottie, 5 parcours).
Purges conformité : `purgeStaleDrafts` prête + testée (90 j, +R2) —
planification avec les crons Phase 3 (`pg_cron` absent en local, constaté
2026-09-29) ; journal modération 2 ans : mécanisme à dater (échéance 2028) ;
sauvegardes 30 j : runbook déploiement (rotation Supabase).

## Décisions verrouillées (ne pas rouvrir sans raison)

- Categories statiques · draft inclus · seed dev-only · avis V1.5 ·
  MRR plus tard · R2 (pas Storage) · pg_cron seul · repli neutre UTC ·
  double verrou appels · cooldown global · footer partagé · logos PNG.
