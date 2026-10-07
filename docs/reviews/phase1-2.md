# Review Phases 1+2 — rapport (pas de correctif dans ce lot)

> Date : 2026-09-29. Périmètre validé : Phases 1+2 + points de contact
> (proxy, layout, images, emails, API, RLS, seed, mentions légales).
> Méthode : relecture ciblée + sondes d'exécution (données nettoyées).
> Règle : aucun finding sans preuve (fichier:ligne, scénario, sortie sonde).
>
> Verdict : **3 bloquants · 10 majeurs · 21 mineurs.**
> Aucun bloquant n'exige un redesign — tous se corrigent dans le lot
> correctif sans toucher aux contrats validés.

## Bloquants (chemin nominal cassé, prouvé)

### B1. `redirect()` avalé par le `catch` — submit/update affichent un échec après succès

- `app/actions/products.ts:117-128` (submit), `:186-197` (update).
- `redirect()` lève `NEXT_REDIRECT` **dans** le `try` → intercepté par le
  `catch` → `captureError` + retour `{ ok:false, "Soumission impossible…" }`.
- Conséquences : fiche créée mais l'utilisateur lit un échec (resoumet en
  double) + **un événement Sentry par submit réussi** (bruit qui masquera
  les vrais incidents).
- Preuve : lecture (les actions `auth.ts`/`profile.ts` appellent `redirect`
  hors `try` — le pattern correct existe déjà dans le repo).
- Fix : sortir `revalidatePath` + `redirect` du `try` (ou re-lancer si
  digest `NEXT_REDIRECT`).

### B2. Clic sur une catégorie = submit involontaire (brouillon fantôme)

- `components/submit/submit-categories-section.tsx:61` — `<button>` sans
  `type="button"` dans le `<form>` → submit natif, `intent` absent →
  `asDraft: true` → **brouillon créé + redirection**, travail en cours
  interrompu.
- Preuve : lecture (tous les autres boutons du formulaire ont `type`,
  vérifié un par un : basics, metadata, media, tags).
- Fix : `type="button"` (1 ligne).

### B3. L'édition efface silencieusement le changelog mergé

- `services/products.service.ts:931-934` (patch) + `:440-441` (merge create).
- Au create, `changelogUrl` est mergé dans `links.changelog`. À l'update,
  `links` est **remplacé** par la carte envoyée — et le formulaire ne rend
  jamais le champ `changelog` (matrice, `hint` lignes 272-280) → toute
  édition supprime `links.changelog`. Symétriquement, `changelogUrl` envoyé
  à l'update est ignoré sans erreur (clé inconnue écartée).
- Preuve sonde (données nettoyées) :
  `A. links après create: {"changelog":"https://example.com/CHANGELOG"}`
  `B. links après edit nom: {}` · `C. pas de crash, links: {}`.
- Fix : merger `data.changelogUrl` dans `data.links` côté update comme au
  create (et ne jamais envoyer la clé brute au patch).

## Majeurs (conditions plausibles, données ou conformité)

### M1. Guard orientation après commit — fiche mixte persistée + erreur affichée

- `services/products.service.ts:947` (update) puis `:958-964` (guard).
- `game` landscape → `galleryOrientation: "portrait"` sans nouvelles
  captures : refus levé **après** `UPDATE` → `gallery_orientation` vaut
  `portrait` avec d'anciennes captures paysage = l'invariant « jamais de
  mix » violé en DB, l'utilisateur lit une erreur.
- Preuve sonde : `D. refus: Orientation modifiée — …` +
  `D. orientation persistée: portrait (attendu: landscape)`.
- Fix : guard avant l'`UPDATE`.

### M2. « Au moins un point d'accès requis » non appliqué serveur

- Le formulaire l'affiche comme requis ; `submitProductSchema`/`updateProduct`
  ne l'exigent jamais (`assertLinksReachable({})` = no-op, aucun appel à
  `hasAccessPoint` côté service).
- Conséquence : fiche publiable avec zéro lien = produit indécouvrable +
  charge revue + porte ouverte au spam low-effort.
- Fix : exiger `hasAccessPoint(links)` au publish (draft exempté — voir
  mineur « drafts stricts »).

### M3. Règles `required` de la matrice jamais lues serveur (kids non conforme)

- `required: "kids"` (`privacy`, `kidsafety`) et `"monetized"` ne sont
  évalués nulle part côté service (`assertLinksReachable` ne vérifie que
  `storePattern`). Pire : l'input « politique sécurité enfants »
  (`submit-basics-section.tsx:121-130`) n'a **pas d'attribut `name`** →
  jamais soumis. Un produit `kids` est publiable sans aucun lien kids
  malgré le badge « requis » et la checklist admin.
- Fix : valider `requiredFor(field, type)` côté service + `name` manquant.

### M4. Champs morts : secrets et déclarations collectés puis jetés

- Clé API revenus (`submit-metadata-section.tsx`) : pas de `name` →
  jamais envoyée. L'UI collectait un **secret de facturation qui ne va
  nulle part**.
- Toggle « Partage de données » : aucun hidden input → `sharesData`
  toujours `false` en revue alors que le maker déclarait Oui.
- **RÉSOLU (lot correctif, autrement que recommandé)** : le retrait pur a
  été écarté (destructif, sans feu vert). Revenus → UI restaurée et
  **désactivée** (`disabled` + badge « Bientôt » + note : zéro secret
  collecté avant le lot MRR). Partage → **rendu réel** (colonne
  `shares_data`, migration `0017`, câblé submit/edit/mobile, revue,
  pré-rempli).

### M5. Changement de type supprime silencieusement les liens masqués

- Les champs liens du type précédent sont démontés du DOM → absents du
  `FormData` → `links` remplacé sans eux (ex. `cli` → `saas` perd
  `registry`/`releases` sans avertissement).
- Le re-revue se déclenche (direction sûre) mais la perte est silencieuse.
- Fix : hidden inputs miroirs du contexte `linkValues`, ou confirm
  explicite au changement de type.

### M6. Un maker banni ne peut plus supprimer ses produits (RGPD)

- `deleteMyProduct:1087` commence par `assertNotBanned`, et le dashboard
  est inaccessible aux bannis → **aucun chemin** de suppression produits.
  Le contrat mobile affirme l'inverse pour le compte (« droit inaliénable »,
  `me/route.ts:89`) — incohérence interne + principe RGPD.
- Fix : retirer `assertNotBanned` de `deleteMyProduct` (ownership suffit).

### M7. Proxy : incident Auth → redirect signin (boucle redoutée)

- ~~`proxy.ts:60-89` : incident → redirect signin~~ **RÉTRACTÉ au
  correctif** : relecture du chemin complet — ligne 82 fait déjà
  `return response` à l'épuisement du retry (pass-through, layouts
  tranchent) ; seuls 4xx et session absente mènent au signin. Le code
  fait ce que le commentaire promet. Aucun fix.
  (Le fallback DB admin reste fail-closed — posture correcte.)

### M8. File revue : incident DB → « File vide, beau travail »

- `getReviewQueueList` (`actions/products.ts`) catch-all → `[]` ; la file
  vide affiche une célébration. Une panne DB masque un dépassement SLA aux
  seules personnes qui doivent le voir. Même pattern (404) sur
  `getReviewItemById` — moins grave (pas de message mensonger).
- Fix : distinguer `NOT_FOUND` (vide/404 honnêtes) de l'incident (état
  d'erreur visible, Sentry déjà alimenté par ailleurs).

### M9. `deleteProductAsAdmin` ne purge pas R2 (orphelins éternels)

- `services/products.service.ts:1114-1127` — delete DB seule, contrairement
  à `deleteMyProduct:1102-1109` qui purge logo + captures best-effort.
  Chaque retrait admin laisse des objets R2 facturés et contraires à la
  politique « purge » des mentions légales.
- Fix : même purge best-effort que le maker.

### M10. Double verdict concurrent (approve + reject, 2 emails)

- `reviewProduct:1037-1063` — check `pending` puis `UPDATE` non atomique :
  deux staffs (ou deux onglets) la même seconde → dernier écrivain gagne,
  **les deux emails partent** (publié + rejeté).
- Probabilité faible (solo) mais fix trivial : `UPDATE … WHERE
status='pending'` + 0 ligne affectée → `CONFLICT`.
- (Le double-clic est déjà gardé côté `ReviewVerdict.pending`.)

## Mineurs (polis, perfs, docs — par ordre de lecture)

- **m1.** Course slug (`freshProductSlug` check-then-insert) : doublon
  simultané → 23505 brut → message générique + bruit Sentry. Retry suffixe
  ou `CONFLICT` franc.
- **m2.** `linksChanged` par `JSON.stringify` (`:923`) : ordre de clés
  différent (mobile) → re-revue superflue. Direction sûre ; canoniser ou
  comparer par ensemble.
- **m3.** `ilike %q%` (`fetchAdminProducts`) : `%`/`_` saisis = jokers
  (qualité recherche, paramétré donc pas d'injection).
- **m4.** Re-select `iconUrl` redondant (`:972-976`, déjà dans `row:904`).
- **m5.** `assertLinksReachable` rejoue tous les liens à chaque édition
  même inchangés (cache 24 h, coût résiduel) — gater sur `linksChanged`.
- **m6.** `categories: []` défini écrase sans fallback (`category` gardée,
  `categories` vide → affichage sur `??` ok mais état incohérent) —
  refuser vide quand défini.
- **m7.** `parseJsonArray` muet (`[]` sur JSON malformé) — `platforms: []`
  échoue en 422 générique ; `categories: []` retombe sur `[category]`
  (défaut silencieux).
- **m8.** `OverviewApps` : `useState(initialApps)` — `router.refresh`
  ne réinitialise pas l'état (suppressions locales ok, nouveautés
  invisibles sans remontage).
- **m9.** `onShots` : abandon au premier fichier invalide, les suivants
  sont jetés sans message.
- **m10.** Désélection dernière catégorie → `category: ""` → 422 générique
  (pas de message champ).
- **m11.** `fetchMyProducts` sans `LIMIT` (+ commentaire `LIMIT/OFFSET`
  dans `OverviewApps:52` sans pagination réelle) — V1 ok, à dater.
- **m12.** `opts.label` (`lib/images.ts`) jamais lu — option morte.
- **m13.** Clés R2 `Date.now()` seul : collision si 2 uploads même ms
  (même produit+kind) → suffixe aléatoire.
- **m14.** `products_select_own` sans `deleted_at IS NULL` (défense
  PostgREST uniquement ; service filtre déjà).
- **m15.** Contrats mobile : `screenshots ×0–6` au POST alors que publish
  exige ≥1 (préciser) ; `hasInAppPurchase: false` des deux côtés (parité
  assumée, non documentée).
- **m16.** Seed : `upvoteCount` sans lignes `votes` + `galleryOrientation`
  figée `landscape` sur les lignes existantes (dev-only ; **input Phase 3** :
  trancher recompte vs incrément avant `toggleVote`).
- **m17.** `next/image` logos stripe/revenuecat (5 fichiers :
  `submit-metadata-section`, `api-connections`, `supported-providers`,
  `how-it-work`, `revenue-method`) — `width`/`height` CSS asymétriques →
  warnings console. Fix `auto` dimensionnel.
- **m18.** Layout gate (`(site)/layout.tsx:13-15`) : session + onboarding DB
  sur chaque page publique, séquentiel — **cause probable n°1 des 2–10 s**
  constatées. Fix prévu lot perf : skip sans cookie de session.
- **m19.** `MaxListenersExceededWarning` (Gzip) **non attribué** :
  singletons vérifiés (R2, Resend, Redis, watcher cleanup ok). Triage :
  reproduire sous `next start` (prod) + `--trace-warnings` ; pas de fix à
  l'aveugle.
- **m20.** Drafts aussi stricts que publishes (liens injoignables, fichiers
  ) sauf médias requis — un brouillon en panne de réseau tiers est
  insauvegardable. Assouplir (reachability publish-only) ou assumer.
- **m21.** Suppression admin silencieuse côté maker (approve/reject
  notifient, `product_removed` non) — notifier ou assumer.

## Conformité rétention (`lib/legal-content.ts:47-90` vs code)

| Politique                          | État code                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Compte/produits (durée du compte)  | ✅ hard delete + cascade                                                                                 |
| Clé facturation (révocation→purge) | ⏳ table inexistante — exigence enregistrée pour le lot MRR                                              |
| Brouillons 90 j                    | ❌ aucune purge (**job `pg_cron` à créer** : `draft` + `updated_at` < 90 j + objets R2) ; **M9** aggrave |
| Anti-abus/IP 30 j                  | ✅ par construction (clés rate-limit à TTL fenêtre, IPs jamais stockées — vérifié 2 usages)              |
| Modération 2 ans                   | ⏳ conforme par âge, **aucun mécanisme — échéance 2028 à dater**                                         |
| Stats agrégées (indéfini)          | ✅ anonymes, non ré-identifiables                                                                        |
| Sauvegardes 30 j                   | 🏗️ hors code → runbook déploiement (rotation Supabase)                                                   |
| MRR conservés                      | ⏳ même exigence que clés (lot MRR)                                                                      |

## Points de contact relus sans finding

- `apiCatch` : mapping codes→statuts propre ; `INVALID_BODY` sur JSON
  malformé ; jamais de 500ิศ sur `request.json()`.
- Emails `product-review` : échappement HTML systématique, texte brut
  non échappé (correct), `origin`/`timeZone` câblés, sujets FR.
- RLS : deny-all effectif côté PostgREST (zéro policy = refus) ; modèle
  réel = allowlists service (`publicMakerSelect`, jointures minimales,
  jamais d'email en public) — discipline tenue partout où vérifié.
- `useAppealsWatcher` : cleanup + flag `cancelled` corrects.
- Mobile `PATCH` partiel : `undefined` = conservé (dont `isChildDirected`,
  cf. fix embarqué), `links` absent = conservé / présent-vide = effacé.
- `updateProductAction` : `targetCountries`/`languages` non envoyés par le
  web = préservés (cohérent) ; `?edit=` restreint à l'auteur (issus de
  `fetchMyProducts`) ; `submit-client` état honnête si autrui.
- Seed/verify : hermétiques (maker dédié, purge fantômes auth), 49/49.

## Sondes exécutées (nettoyées)

1. `links` après create avec `changelogUrl` → mergé ✅ ; après edit nom
   avec `links: {}` → **`{}` (B3)** ; update avec `changelogUrl` → ignoré
   sans erreur (B3).
2. `game` landscape → `galleryOrientation: "portrait"` sans captures →
   refus **mais** `portrait` persisté (**M1**).
3. Sonde supprimée (`scripts/probe-review-tmp.ts`), DB sans résidu
   (vérifié : produits + maker de sonde supprimés).

## Correctifs appliqués (lot du 2026-09-29) — à valider avant Phase 3

- **B1** : `revalidatePath` + `redirect` sortis des `try` (submit + update).
- **B2** : `type="button"` sur les pills catégories.
- **B3** : merge `changelogUrl`→`links` à l'update + préservation du
  changelog existant (remplacement total sinon) ; vérifié (B3, B3-bis).
- **M1** : guard orientation avant tout commit ; vérifié (refus + ligne intacte).
- **M2/M3** : `assertLinkRules` serveur (point d'accès + kids/monétisé) ;
  vérifié (M2, M3). Drafts exemptés (reachability publish-only).
- **M4** : revenus → UI restaurée **désactivée** (zéro secret collecté) ;
  tiers → colonne `shares_data` (migration `0017`) câblée partout.
- **M5** : hidden mirrors des liens masqués (changement de type sans perte).
- **M6** : `assertNotBanned` retiré de `deleteMyProduct` (droit inaliénable).
- **M7** : RÉTRACTÉ — le code faisait déjà le pass-through (l.82).
- **M8** : erreurs honnêtes (rethrow `ProfileError`, incident → erreur
  visible) + `force-dynamic` sur pages staff/perso (le build a exigé :
  le pré-rendu statique sans session crashait — nouveau finding mineur
  attrapé par le build lui-même).
- **M9** : purge R2 admin (miroir maker) + email `product-removed`
  (template + envoi best-effort, motif requis).
- **M10** : `UPDATE … WHERE status='pending'` + `CONFLICT` si 0 ligne ;
  vérifié (double verdict).
- Mineurs embarqués : m1 (retry 23505), m2 (comparaison canonique), m3
  (`ilike` échappé), m4 (select redondant supprimé), m5 (reachability si
  changement), m6 (catégories vides refusées), m7 (JSON malformé → 422
  nommé), m9 (erreurs cumulées par fichier), m12 (`label?` supprimé), m13
  (suffixe aléatoire clés R2), m14 (RLS `deleted_at`), m15 (contrats
  précisés), m17 (`h-auto` 3 fichiers : metadata stripe,
  supported-providers stripe, api-connections stripe), m20 (drafts sans
  reachability), **garde back navigateur** (`pushState` factice + `popstate`
  → modale `ConfirmDialog` ; `go(-2)` à la confirmation — `beforeunload`
  seul ne couvre pas la navigation SPA), purge 90 j (`purgeStaleDrafts` +
  testé, planification avec les crons Phase 3 — `pg_cron` absent en local,
  constaté).
- Différés assumés : m8 (staleness `useState` — impact nul en pratique),
  m11 (pagination dashboard), m16 (recompte vs incrément — input Phase 3),
  m18 (gate layout — lot perf),
  **m19 (warning Gzip — FAUSSE ALERTE : non reproduit sur serveur frais ;
  notre code éliminé — zéro `zlib`, singletons vérifiés, Sentry inactif en
  dev ; bruit de session dev-only, à rouvrir uniquement si vu en prod)**,
  m21 (notif retrait — FAIT : template + envoi, motif requis).
- Vérifs : `verify-products-backend` **60/60** (×2 runs), `verify-email-templates`
  **101/101**, `tsc` 0, `eslint .` 0, `prettier --check .` vert, `build` vert
  (69 pages). Migration `0017` appliquée, `db:setup` re-appliqué (41/41).
