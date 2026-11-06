# Client desktop natif — cadrage v2 (Wails v3)

> **Statut : révision v2, datée du 06/11/2026.** La décision de stack (du
> 30/10/2026, en session avec l'opérateur) est consignée en §6 ; tout ce
> qui s'y trouve est cadré, pas livré. Ce document vit dans « Vivant »
> tant qu'il sert, et bascule en archive le jour où la décision est
> exécutée (ou abandonnée). La v1 (dans l'historique git) laissait la
> stack « Tauri vs Electron vs UI native » ouverte — tranchée depuis, à
> l'endroit exact que le document prévoyait.

## 1. De quoi on parle

Un **client desktop natif de la plateforme Mada Made** (Windows-first,
macOS/Linux en observation) — une application installable, avec sa
fenêtre, son icône, son installeur, son flux d'auth.

C'est un article de cadrage, pas une fiche technique : le jour où on
l'exécute, il faut savoir ce que la plateforme doit exposer et ce qu'on
ne veut surtout pas faire.

### Ce que ce n'est pas (garde-fous)

| Ce n'est pas                                        | Pourquoi                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Une **PWA** (site installable depuis le navigateur) | Refusé : pas de vraie présence desktop, pas de dialogue natif, pas d'installeur. La PWA reste un bonus possible, pas le sujet.             |
| Un **build Flutter desktop**                        | Flutter est un framework **mobile** ; le port desktop existe mais n'a rien d'un desktop natif en production (poids, packaging, ergonomie). |
| Un **deuxième produit** (une app, un site séparé)   | Le client consomme la même API v1 et la même base via PostgREST que le mobile. Pas de second back, pas de second modèle de données.        |
| Une histoire de **store**                           | Refusé d'emblée : pas de store desktop, la distribution va par nos liens (route de téléchargement) ou GitHub Releases.                     |
| Un chantier calendaire                              | Le déclencheur reste le §5.                                                                                                                |

## 2. Pour qui ? (la question à trancher en premier)

Trois usages plausibles, un recommandé :

| Usage                                                                                                                        | Verdict                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atelier maker** — uploader un binaire, lire les stats, rédiger des notes de version, suivre les revenus, répondre aux avis | **Recommandé.** C'est le seul usage qui justifie une app native : du travail long, sur un grand écran, avec des fichiers à sélectionner. Le dashboard web existe déjà et fait 80 % du job ; le client apporte le reste (dialogue de fichier natif, notifications, multi-fenêtre). |
| Naviguer dans l'annuaire depuis un desktop                                                                                   | **Sans valeur.** Le web est déjà une app desktop.                                                                                                                                                                                                                                 |
| Mode **kiosk / mur d'affichage** pour le compte de veille                                                                    | **Piste, sans code natif** : l'app web en plein écran dans une boutique, un bureau, un événement. Le compte de veille existe déjà (`open-sources`, curation auto). À traiter séparément — et gratuitement.                                                                        |

**Écrans de l'atelier (actés le 30/10)** : accueil, auth,
bienvenue/onboarding, **soumission produit complète**, binaires,
dashboard maker — **atelier maker seul, aucun mode staff**.

**Fiche en revue** : « preview produit en pending » = le maker voit SA
fiche telle qu'elle s'affichera une fois publiée, servie par
`product_revisions`. Vérifié en prod le 06/11 : la policy
`product_revisions_select_own` existe déjà (own via `maker_id`, ou via
le produit du maker) — **aucune migration à poser côté base pour ce
volet.**

## 3. Ce qui existe déjà (le socle)

| Brique                                                                         | État                                    | Source                                |
| ------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------- |
| Web app (Next.js App Router)                                                   | ✓ en production                         | `app/`                                |
| App mobile native (équipe Flutter)                                             | quasi verte — smoke test EF en cours    | équipe mobile                         |
| **API v1** (REST + Bearer)                                                     | ✓                                       | `docs/mobile-contrats.md`             |
| Auth : Google one-tap, GitHub/GitLab (navigateur), OTP email, `providers/sync` | ✓ (le mobile consomme ces trois volets) | `docs/auth.md` · `app/api/v1/auth/…`  |
| Upload binaire **multipart resumable** (chemin mobile)                         | ✓ — se réutilise tel quel               | `app/api/v1/uploads/presign/route.ts` |
| Bucket privé + presign 5 min                                                   | ✓                                       | `lib/r2.ts`                           |
| Dashboard maker (stats, revenus, builds, avis)                                 | ✓ (app Next)                            | `app/(dashboard)/`                    |
| Taxonomie 9 plateformes (dont `windows`/`macos`/`linux`/`desktop`/`embarque`)  | ✓                                       | `config/platforms.tsx`                |
| Policy SELECT own sur `product_revisions` (fiche du maker en revue)            | ✓ vérifié en prod le 06/11              | migrations 0050+                      |

## 4. Doctrine v2 : la traduction fidèle des flows mobiles

Le fil du 30/10 a reformulé le contrat : le client n'invente rien, il
**traduit fidèlement les flows du mobile** (la référence du contrat est
le code réel de l'app Flutter, `live_auth_repository.dart`, 783 lignes),
et distingue pour cela **deux familles** d'opérations.

### Famille A — écritures perso, arbitre = la base (PostgREST direct)

Tout ce qui n'a **ni clé secrète, ni vérité hors-DB** de son côté :

- **profil** (bio, `social_links`, site, ville, pays…) — chaque règle est
  un `CHECK` ou un grant de colonne ; `role` reste intouchable par
  construction (colonne jamais grantée, pas « filtrée ») ; le garde-fou
  du ban est déjà la policy `banned_at IS NULL` sur les writes de
  `users` ;
- **onboarding** (nom, occupation, « email modifiable ssi placeholder » —
  le `WITH CHECK` lit la ligne précédente) — la base arbitre le flag, pas
  le client ;
- **providers** — écriture directe de `users.providers` + sync
  best-effort (miroir de la vérité GoTrue).

Ces ponts-là servent le **desktop ET le mobile** (doctrine des ponts
0055/0060).

### Famille B — reste serveur, une raison physique à chaque fois

1. **presign uploads** (médias + binaire) : les clés R2 ne sortent jamais
   du serveur ;
2. **providers/sync** : la vérité (identités GoTrue) n'est pas lisible
   par PostgREST ;
3. **échange OTP (email)** : le code 6 chiffres n'est PAS un token
   Supabase (template sans `{{ .Token }}`), la vérification et la remise
   de tokens passent serveur (`/api/v1/auth/otp/request` + `/verify`).

### Auth desktop — traduction des flows mobiles

| Composant mobile                                    | Équivalent desktop                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| One-Tap Google (`signInWithIdToken`)                | même flow, servi par la webview / le navigateur système                                             |
| Custom Tab GitHub/GitLab + scheme mobile `mg.riri…` | navigateur **système** + scheme **desktop** dédié (`madamade://`), Redirect URLs Supabase à ajouter |
| routes `auth/otp/request` + `verify`                | réutilisées telles quelles — fournissent tout l'échange de tokens                                   |
| `providers/sync`                                    | réutilisée telle quelle                                                                             |
| `flutter_secure_storage`                            | **DPAPI**                                                                                           |
| `watchBanned` (Realtime sur sa ligne `users`)       | identique                                                                                           |
| profil / onboarding direct (Famille A)              | identique                                                                                           |

## 5. Quand ? (le déclencheur)

Le déclencheur **n'est pas calendaire** :

> **Après la mise en production du web ET du mobile.** Le web est en
> prod ; le mobile est quasi vert (le smoke test EF du lot 0065 est en
> cours au 06/11). Le client desktop attend le feu vert mobile — c'est la
> même fenêtre d'attente que les signaux ci-dessous.

**Signaux qui feraient avancer le chantier** (à surveiller, pas de
date) :

- des makers réclamant un besoin **spécifique desktop** (atelier) ;
- une demande explicite de l'équipe mobile d'un compagnon desktop ;
- un volume d'ateliers maker qui rendrait le dashboard web inconfortable.

## 6. Décisions tranchées / encore ouvertes

### Tranchées

- Client **natif**, pas PWA.
- Pas de **store** : distribution par nos liens ou GitHub Releases.
- **Une seule API** (v1) pour les trois clients — **révision par rapport
  à la v1** : PostgREST direct pour les écritures perso et les lectures
  (Famille A), API v1 restreinte aux raisons physiques (Famille B).
  Aucun second back, aucun contrat parallèle.
- Auth desktop : **Google One-Tap + GitHub/GitLab (navigateur système) et
  les 2 routes OTP existantes** ; tokens en **DPAPI** ; `providers/sync`
  réutilisée ; `watchBanned` identique — **côté serveur, rien à
  écrire**.
- **Stack client : Wails v3 (Go)** — décision de l'opérateur du 30/10 :
  webview système (WebView2, déjà présente sous Windows 10/11), Go
  batteries incluses ; ni Electron, ni la chaîne d'outillage Tauri
  (Rust). L'installation et `wails3 doctor` ont déjà été vérifiées
  (env ok).
- Le pipeline binaire **multi-OS n'est pas un prérequis** du client
  desktop (les produits desktop restent des fiches + liens).
- Le déclencheur est la **mise en prod du web + du mobile**, pas une
  date.

### Encore ouvertes (au spike D0 et après)

- **Auto-update** : manuel d'abord (« Vérifier les mises à jour » →
  télécharger l'installeur → relancer, servi par GitHub Releases) ;
  réévaluer selon les capacités réelles de Wails v3.
- **UI de l'atelier** : quelle UI embarquer dans la webview (la v1
  laissait « UI native » ouverte par son §6) — à trancher avec une
  maquette concrète de l'écran d'accueil/submit.
- Le mode kiosk : à traiter côté web (gratuit) ou dans le client ?
- Si et quand le pipeline binaire multi-OS (Authenticode, notarisation,
  paquets Linux) doit exister — décision indépendante de ce client.

## 7. Le jalon D0 (spike — pas daté, préparé ici)

Le D0 part au **déclenchement** (§5) et n'ouvre rien avant que la mise
en prod mobile soit signée :

1. **Init Wails v3** (windows/amd64) : projet minimal, packaging NSIS,
   hot reload — l'environnement est déjà en place (`wails3 doctor`
   vérifie `go`, WebView2, windows kit, signature).
2. **Port auth** : les 3 providers + OTP (routes v1 existantes) +
   `providers/sync` + tokens en **DPAPI** + `watchBanned`.
3. **Maquette submit premium placeholder** : valider le style du client
   avec l'opérateur avant tout autre lot.

**Critères de sortie D0** : « se logger via l'un des 3 providers + un
submit placeholder qui soumet une maquette de fiche et se recharge
proprement ».

## 8. Historique

- **06/11/2026** — réécriture complète (v2) : la stack Wails v3 est
  consignée ici pour la première fois ; sondes prod `product_revisions`
  (lecture seule) : la policy select_own préexiste, la preview maker
  n'exige aucune migration.
- **30/10/2026** — session opérateur + agent (plan mode) : l'opérateur
  propose **Wails v3 (Go)** ; l'agent « plan » le rejoint sur le fond
  (Windows-first, Rust jugé trop lourd pour l'écosystème local, « c'est
  la décision prévue par le §6 de la doc ») avec deux nuances honnêtes
  (Wails v2 sans auto-update natif ; v3 alors récent). L'opérateur
  tranche : **v3 stable, déjà installé, `wails3 doctor` a les kits vus**.
  Le fil fait ensuite sienne la doctrine **PostgREST direct** (Famille
  A) sur le modèle des ponts 0055/0060 de la base, et inscrit le plan de
  traduction des flows mobiles.
- **27/09/2026** — v1 du cadrage rédigée (Tauri/Electron/UI native en
  ouverte, déclencheur non daté, pipeline multi-OS hors lot).
