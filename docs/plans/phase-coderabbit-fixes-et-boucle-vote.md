# Plan — Fixes CodeRabbit + boucle UX (vote, realtime, déconnexion)

> Document de pilotage (opérateur + agent). Tenu à jour à chaque slice :
> un statut périmé ici est un bug, pas un retard — cf. règle docs/README.
> Le détail vivant (preuves, vérifications) reste au CHANGELOG.

## 0. Règles permanentes

- **Push unique en fin de série** : commits par slice autorisés dès que
  les gates sont vertes (rythme ratifié par l'opérateur, 2026-10-28) ;
  le PUSH reste un go explicite et unique, après le dernier lot.
- **Portes avant tout commit** : `npx tsc --noEmit`,
  `npx eslint --max-warnings=0`, prettier, verify des chemins touchés,
  `npm run build` (timeout 900 s).
- **Migrations** : web versionnées, `--> statement-breakpoint`,
  `db:migrate:local` ; JAMAIS modifier une migration appliquée — une
  correction = une nouvelle migration (0055 → 0056, journal drizzle).
- **Zéro chiffre inventé** : vide honnête partout ; échec franc > faux
  chiffre. FR partout en UI, thèmes clair/sombre, 375 px. Secrets
  jamais loggés, affichés ou committés.
- **Hors périmètre** : le wordmark rétréci (`components/ui/wordmark.tsx`)
  - intégration `/signin` — travail en cours de l'opérateur, resté non
    committé dans le working tree ; il rejoindra le PR dans un commit à
    part quand il sera fini.

## 1. Déjà exécuté dans cette session (ne pas refaire)

- [x] **PR #11 ouvert** — https://github.com/Hawks124/Mada-Builder/pull/11
      (head `feat/lots-bce-quota8` → base `main`, 15 commits à la création,
      70 fichiers).
- [x] **Item 5 — docs squad** (`2c4d08b`) : fiches data `reviews.md` /
      `comments.md` / `comment_votes.md` + `index.md` + contrat mobile
      alignés sur le pont 0055 (« Écriture directe OUVERTE », la base
      arbitre, triggers attribués).
- [x] **Compteurs hero réaffichés** (`3bf0258`) : totaux réels même
      faibles, mock makers supprimé avec le backend, `SHOW_HERO_STATS`
      conservé (`true`).
- [x] **Item 9 — navbar 320 px** (`c2b5421`) : ThemeToggle descendu dans
      le menu mobile sous `sm` (`hidden sm:block` + rangée en bas du drawer
      `mt-auto pt-3 border-t`) — mesuré live : avant 320.3 px pour 288
      utiles (débordement 32.3), après 274.3 px (marge 13.7). Ton wordmark
      h-8 / `sizes="112px"` intact.

## 2. Lot A — les 3 critiques CodeRabbit (merge-blocking)

- [x] **Migration 0056** (`db/migrations/0056_fix_rls_user_devices_and_revisions.sql`,
      appliquée en local via `db:migrate:local`) :
  - [x] `user_devices_update_policy` : `USING (true)` → `USING (user_id
IS NULL OR user_id = auth.uid())` (WITH CHECK inchangé) — le hijack
        cross-user (lecture de tous les tokens FCM) est mort, prouvé par
        verify : hijack de la ligne d'autrui = 0 ligne, UPDATE blanket
        = 0 ligne, vol d'une ligne possédée = 0 ligne.
  - [x] `product_revisions_insert_own` : `OR EXISTS(...)` →
        `AND EXISTS(...)` — une révision sur la fiche d'AUTRUI est refusée
        (42501), la révision du propriétaire passe (flux web intact).
  - [x] Flux de claim vérifié empiriquement (sondes SQL) : le claim
        invité→utilisateur était DÉJÀ une affaire SERVICE avant 0056 — la
        policy SELECT (user_id = auth.uid()) masque les lignes NULL à tout
        `authenticated`, même via upsert `ON CONFLICT` (42501 USING), et un
        UPDATE ciblé échoue au GRANT (SELECT révoqué sous anon). 0056 ne
        change RIEN ici : la future voie = API web service_role. Risque
        résiduel PROUVÉ et assumé : un UPDATE SANS WHERE (aucune colonne
        lue) passe le grant et flipp l'is_active de tous les invités — la
        fermer demandera un RPC SECURITY DEFINER vérifiant le token, côté
        squad mobile.
- [x] **csp-report** (`app/api/csp-report/route.ts`) : l'enveloppe W3C
      `raw["csp-report"]` est extraite AVANT la lecture des champs (repli
      racine, tableau traité) — les reports n'écrivent plus "?" à vide.
- [x] Verify : `scripts/verify-0056-rls.ts` 9 ok / 0 KO + `verify-mobile-direct`
      37 OK / 0 KO (le pont 0055 tient toujours).
- [x] Commit `fix(db)` — `8632ccf` (0056 + journal + csp-report + verify
  - ce plan).

## 3. Lot B — quick wins cron / notifications

- [x] maintenance : le `.catch(() => ({ aborted: 0 }))` sur le listage
      multipart est supprimé (`app/api/cron/maintenance/route.ts:47`) →
      l'échec remonte dans `failures` → 503 (la règle « 200 menteur
      interdit » écrite 5 lignes plus bas est devenue vraie).
- [x] digest hebdo : `throw` si `!dry && eligible > 0 && sent === 0`
      (`services/notifications.service.ts`) → le catch existant retire
      le verrou posé (confirmé : « on retire le verrou QU'ON A POSÉ »)
      → 500 via `apiCatch` → workflow rougit ; l'audit ne s'exécute pas
      (un échec n'est pas un historique de succès) ; le dryRun n'est
      jamais touché (`!dry`).
- [x] dead man switch : fraîcheur **par connexion active** — sous-
      requête corrélée `MAX(s.captured_at) WHERE s.product_id = …`
      (une connexion = un produit, requête indexée) ; une seule
      connexion en retard suffit à briser le silence (le MAX global
      masquait les mortes > 26 h derrière celles qui sync bien) ; le
      message Sentry liste chaque connexion morte (id, provider,
      dernier snapshot ou « jamais »).
- [x] Verify : `verify-notifications` 26 OK / 0 KO — dont un ajustement
      de TEST : « RLS anon fermé » accepte les deux fermetures
      légitimes (401 = grant SELECT révoqué, forme actuelle du projet
      cloud ; 200 + 0 ligne = policy masque). Un 200 avec des lignes
      reste un échec franc. Diagnostiqué par sonde : 401 + 42501
      grant — anon ne lit rien dans les deux formes.
- [x] Commit `fix(cron)`.

## 4. Lot C — flicker vote 4→5→4

- [x] Le compteur optimiste est **gelé au clic** (`frozenCountRef`,
      `components/votes/vote-button.tsx`) : le reducer `useOptimistic`
      était re-invoqué à chaque render intermédiaire de la transition
      (payload RSC revalidé, réponse qui met `confirmed` à jour pendant le
      vol) et re-décalait le compteur depuis `state.count`. Pendant le
      vol, l'affichage ne dépend plus ni d'une prop fraîche ni de l'état
      confirmé ; la réponse serveur reste **autoritaire** (`setConfirmed`)
      et prend le relais au jet de l'optimiste ; les refus (mur, compte
      jeune, erreur) reviennent toujours à l'état confirmé.
- [ ] Repro live avant/après : le vote exige une session (mur auth —
      voulu), aucune session de test n'est documentée → à mesurer avec
      l'opérateur (qui a vu le flicker) en fin de série, en même temps
      que les lots D/E.
- [x] Commit `fix(ui)`.

## 5. Lot D — déconnexion sans pending (repro live requise)

- [x] **Repro live fait** (2026-10-29, opérateur connecté sur le dev
      server) : le spinner **est peint** — l'hypothèse « la phase
      pending ne peint jamais / fix flushSync » est réfutée. Ce que dit
      l'opérateur : spinner visible, puis Next rendering pendant lequel
      le spinner s'arrête, et le dialog ferme à la fin de la
      navigation. Les logs serveur confirment la mécanique : `signOut()
in 695ms` (l'action), puis revalidation du layout — le layout se
      re-rend AVEC LA SESSION MORTE (la déconnexion est déjà réalisée),
      ce qui remplace le composant : le spinner s'arrête exactement
      quand le serveur a confirmé le signOut, et le dialog ferme quand
      l'accueil public peint. L'amplitude observée en dev est la
      compilation Turbopack (recompile du module instrumenté + premier
      hit de la page publique : 18–20 s), imperceptible en prod.
- [x] **Diagnostic : rien à coder** — le câblage statique était bon
      (`isPending` posé au clic, spinner peint, dialog maintenu
      pendant la mutation, `revalidatePath` + redirect). Le holder
      d'attendu « fix flushSync » est abandonné, réfuté par le live.
- [x] Instrumentation temporaire retirée (`git checkout` des deux
      fichiers — jamais committée).

## 6. Lot E — realtime home

- [x] **Repro live fait** (2026-10-29, opérateur vote réel sur la home) :
      « tout est cohérent » — aucun doublon de compteur observé entre
      slots. Le fix du lot C (réponse autoritaire + compteur gelé)
      couvre ce que voit le votant. **Docs only — rien à coder.**
- [x] Cross-user Realtime (le vote d'un autre visiteur apparaît sans
      refresh) : **décision V1.5 recommandée — on ne construit pas**.
      Reste documenté ici ; le payload RSC revalidé par le vote fait
      déjà arriver l'état frais aux états suivants (navigation,
      re-render).
- **Constats de l'opérateur pendant le repro** (traités au lot G, §6b) :
  comments count à 0 + label « comment » (anglais) sur home /
  leaderboard / featured ; fenêtre « cette semaine » vide alors qu'un
  vote a été posé hier.

## 6b. Lot G — constats opérateur (2026-10-29) : labels/counters des cartes

- [x] **G1 — leaderboard-list** : compteur discussions HARDCODÉ `0` →
      count réel branché (dénorm `comments_count`, fidèle — sonde :
      opengym 2/2, atmox 1/1, le reste 0 RÉEL) : `LeaderboardItem.commentsCount` + SELECT dans les branches weighted ET window + `toLeaderboardItem`.
      Vérifié live sur `/leaderboard?w=week` : aria « N avis » = 0,1,0,0
      (atmox=1 réel dans le HTML).
- [x] **G2 — libellé des chips discussions** : le vrai problème n'était
      pas un label anglais (aucun « comment » visible dans l'UI) mais
      SÉMANTIQUE : les chips de DISCUSSIONS (`commentsCount`) portaient
      le libellé « avis », réservé aux ratings (V1.5 — cf. discover-row-card
      qui libelle « Commentaires »). Unifié : featured-product (2 branches),
      leaderboard-list (title/aria/sr-only), product-card (+aria_label
      manquante sur la pill). « avis » ne subsiste QUE sur les ratings
      (product-reviews, tooltips `ratingsCount`, admin, dashboard « avis
      en V1.5 »). Counts home vérifiés réels : newest `comments:
n.commentsCount`, updates `b.commentsCount`, featured
      `toFeaturedCard.slot.commentsCount`.
- [x] **G3 — fenêtre « cette semaine » vide : AUCUN BUG, état honnête.**
      Sonde SQL (2026-10-29) : le SEUL produit publié dans les 7 jours
      est `exifcleaner` (1j21h) et il est `curated=true` → exclu du JEU
      (« Curation exclue du jeu »). La fenêtre filtre par
      `published_at >= now-7j` (PRD §11 : « publiés dans la fenêtre ») —
      voulu. Le vote d'hier (atmox/gallery-suite, publiés il y a 9–11 j)
      compte dans le taxo all-time et les fiches, pas dans la fenêtre.
      L'onglet rend l'empty state de 1ère classe §15 : « Semaine calme —
      pour l'instant » + CTA « Soyez le premier à publier » ; les 3
      produits visibles sur la page viennent du classement pondéré
      (all-time) et du hero featured, pas de la fenêtre. Candidat V1.5
      noté (décision opérateur, pas construit) : bascule sémantique
      « votes posés dans la fenêtre, tous produits » si l'onglet vide
      répété déprime la boucle.
- [x] Verify + gates verts ; sonde `scripts/tmp-debug.ts` supprimée avant
      commit ; commit `fix(ui)`.

## 7. Lot F — heavy lifts (un commit chacun)

- [x] **Builds** : index partiel `product_builds_one_pending_uidx ON
(product_id) WHERE status='pending'` (migration 0057, journal idx 54,
      pré-check 2026-10-29 : 0 doublon pending / 0 pending / 12 builds —
      l'index s'applique sans nettoyage, doc dans l'en-tête SQL) + le
      catch de createBuild lit `constraint_name` (direct OU via cause
      Drizzle, même mécanique qu'isUniqueViolation) : contrainte un-pending →
      message « déjà en revue » identique au pré-check, contrainte
      (produit, version_code) → message de version ; objet orphelin purgé
      dans les deux cas. Drizzle schema (db/schema/builds.ts) synchronisé
      (le kit ne re-diff pas). Verify `scripts/verify-0057-one-pending-uidx.ts` :
      4 ok / 0 KO (index unique+valide+prédicat ; second pending → 23505
      contrainte nommée ; rejet libère le re-send D6).
- [x] **R2 idempotent** : `createBuild` renvoie le build existant quand
      le `r2Key` reçu est déjà référencé (sortie AVANT tout HEAD — la clé
      est fraîche à chaque presign, donc ligne existante = le MÊME envoi
      reposté) : retry sur build en revue ne détruit plus l'objet que
      l'admin ouvre, 23505 ne purge plus la clé d'un build approuvé,
      aucun doublon de ligne. Tout purgeur en aval ne purge qu'un objet
      ORPHELIN (aucune ligne ne référence la clé). Verify
      `scripts/verify-builds-idempotent.ts` : 4 ok / 0 KO (retry en
      revue = même id ; retry approuvé = même id ; 0 ligne dupliquée ;
      clé jamais posée refusée). Le refus d'une clé rivale pendant un
      pending n'est PAS repris ici (exige un APK signé sur R2) — la
      règle en base est couverte par verify-0057.
- [x] **Média de révision** : carry-over du média proposé quand l'édit
      ne le touche pas (`carriedMedia` = `previousRevision.media` si
      publiée sans médias fournis, compté dans `needsRevision` — une
      révision média SEULE survivait plus à un édit léger qui l'écrasait
      à null) + purge d'aval garde les objets (kept = captures
      reconduites) + l'orientation PROPOSÉE pré-remplie dans le
      formulaire d'édit (`toDashboardApp` overlay, le maker ne ré-écrivait
      plus le validé et annulait sa proposition) et dans l'aperçu
      (`fetchProductForPreview` — même contrat : « l'aperçu montre ce
      qui sera publié »). Verify scénario 15.6 du harnais
      `scripts/verify-products-backend.ts` : 216 OK / 0 KO (révision
      média seule insérée en base sans R2 ; survie à un édit vide,
      survie à un édit texte via upsert, pré-remplissage réel de
      l'orientation proposée).
- [x] **Purge RGPD appels** : `purgeAppealEvidence` liste en BOUCLE
      (pages de 100 — fini le cap 1000), lit l'`error` de `list()`
      (avant : jetée — une panne se déguisait en « bucket vide ») et
      purge par lots de 100 ; tout échec persiste au backlog
      `gdpr_purge_retries` (owner_id SANS FK : le compte est déjà
      détruit ; migration 0058, table deny-all) et la reprise hebdo du
      cron maintenance (`retryFailedPurges`) la re-traite : purge
      aboutie → ligne retirée du backlog ; nouvelle panne → attempts
      croît, Sentry en parallèle. Une purge saine d'un bucket vide
      libère la ligne aussi (l'échec précédent était transitoire).
      Verify `scripts/verify-0058-gdpr-purge-retries.ts` : 5 ok / 0 KO
      (index unique valide ; lecture `authenticated` refusée ; second
      épisode même owner → 23505 ; reprise exécutée sans crash ;
      cycle sain observé). Crédit du verify : le COMMIT avec
      savepoints + SET ROLE sur la transaction directe répondait
      « permission denied » — phase A en rollback volontaire (pattern
      0057), sonde comitée par drizzle pour la reprise.
      Coordination uploads en vol = lot suivi dédié.
- [ ] Verify + build + commits.

## 8. Fin de série

- [ ] **Push unique** de tous les commits sur PR #11 (go explicite).
- [ ] Opérateur résout les conversations CodeRabbit.
- [ ] CI verte → merge.

## Décisions actées (2026-10-28)

- Ordre ratifié : A critiques → B quick wins → C vote → D/E live → F
  heavy.
- Question A/B : dissoute par la stratégie « tout est codé avant le
  push » — option A étendue à toute la série.
- 8d : minimum maintenant (batch + récupération), coordination uploads
  en lot dédié ensuite.
- Cross-user Realtime : candidat V1.5, pas construit en V1.
