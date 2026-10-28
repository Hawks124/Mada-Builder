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
- [ ] Commit `fix(db)`.

## 3. Lot B — quick wins cron / notifications

- [ ] maintenance : supprimer `.catch(() => ({ aborted: 0 }))` sur le
      listage multipart → l'échec remonte dans `failures` → 503 (la règle
      « 200 menteur interdit » écrite 5 lignes plus bas devient vraie).
- [ ] digest hebdo : `throw` si `!dry && eligible > 0 && sent === 0` →
      le catch existant libère le verrou → 500 → workflow rougit
      (confirmer d'abord que le catch retire bien le verrou posé).
- [ ] dead man switch : fraîcheur **par connexion active** (MAX
      `captured_at` par connexion, plus le MAX global qui masquait les
      connexions mortes > 26 h).
- [ ] Verify + commit `fix(cron)`.

## 4. Lot C — flicker vote 4→5→4

- [ ] Le compteur affiché = celui de la **réponse** de l'action
      (autoritaire, jamais re-dérivé) ; neutraliser la re-dérivation
      `useOptimistic` contre la prop fraîche arrivée mid-transition.
- [ ] Reproduire + mesurer avant/après (dev server local).
- [ ] Commit `fix(ui)`.

## 5. Lot D — déconnexion sans pending (repro live requise)

- [ ] Reproduire nav + dashboard, instrumentation `setIsPending` +
      panneau réseau (l'aller-retour MG→UE dure 300–800 ms : la phase
      spinner ne peint jamais ?).
- [ ] Fix attendu si confirmé : `flushSync(() => setIsPending(true))`
      avant l'appel — mais le diagnostic live tranche avant de coder.
- [ ] Commit `fix(ui)`.

## 6. Lot E — realtime home

- [ ] Vérifier en live ce que voit le **votant** (featured/new/updates
      après son vote) — probablement couvert par le fix du lot C.
- [ ] Cross-user Realtime (le vote d'un autre visiteur apparaît sans
      refresh) : **décision V1.5 recommandée — on ne construit pas**.
- [ ] Docs + commit.

## 7. Lot F — heavy lifts (un commit chacun)

- [ ] **Builds** : index partiel `product_builds_one_pending_uidx ON
(product_id) WHERE status='pending'` (migration) + PRÉ-CHECK des
      doublons en base avant application (l'index échoue sinon) + conflit
      unique géré → `ProfileError` propre.
- [ ] **R2 idempotent** : `r2Key` déjà référencé par un build enregistré
      → retourner le build existant (retry idempotent), ne JAMAIS détruire
      le binaire d'un build en revue.
- [ ] **Média de révision** : carry-over du média précédent quand l'édit
      ne le touche pas + compté dans `needsRevision` + l'orientation
      proposée affichée dans le formulaire d'édit.
- [ ] **Purge RGPD appels (minimum ratifié)** : listage en boucle (fini
      le cap 1000), erreurs `list()` captées (l'erreur vit dans `error`,
      pas en throw), tâche de récupération persistée avec `ownerId` si la
      purge échoue (plus jamais irécupérable). Coordination avec les
      uploads en vol = lot suivi dédié.
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
