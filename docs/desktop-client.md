# Client desktop natif — note de cadrage

> **Statut : note de cadrage, pas un engagement.** Rien n'est daté, rien
> n'est décidé sur le fond. Ce document sert le jour où la question se
> posera — il liste ce que la plateforme doit fournir, ce qui existe déjà,
> et les questions ouvertes. Il vit dans « Vivant » (pas « Archive »)
> tant qu'il sert le cadrage ; il bascule en archive le jour où la
> décision est prise (ou abandonnée).

## 1. De quoi on parle

Un **client desktop natif de la plateforme Mada Made** pour Windows, macOS
et Linux — une application installable, avec sa fenêtre, son icône, son
installeur.

C'est **volontairement un article de cadrage, pas une fiche technique** :
le jour où on le décide, il faut savoir ce que la plateforme doit
exposer et ce qu'on ne veut surtout pas faire.

### Ce que ce n'est pas (garde-fous)

| Ce n'est pas                                        | Pourquoi                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Une **PWA** (site installable depuis le navigateur) | Refusé : pas de vraie présence desktop, pas de dialogue natif, pas d'installeur. La PWA reste un bonus possible, pas le sujet.             |
| Un **build Flutter desktop**                        | Flutter est un framework **mobile** ; le port desktop existe mais n'a rien d'un desktop natif en production (poids, packaging, ergonomie). |
| Un **deuxième produit** (une app, un site séparé)   | Le client consomme l'API v1 existante, comme le mobile. Pas de second back, pas de second modèle de données.                               |
| Une histoire de **store**                           | Refusé d'emblée : pas de store desktop, la distribution se fera par nos liens (route de téléchargement) ou GitHub Releases.                |
| Un chantier daté                                    | Aucun trigger calendaire. Le déclencheur est en §5.                                                                                        |

## 2. Pour qui ? (la question à trancher en premier)

Sans cette réponse, la note dérive. Trois usages plausibles, un
recommandé :

| Usage                                                                                                                        | Verdict                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atelier maker** — uploader un binaire, lire les stats, rédiger des notes de version, suivre les revenus, répondre aux avis | **Recommandé.** C'est le seul usage qui justifie une app native : du travail long, sur un grand écran, avec des fichiers à sélectionner. Le dashboard web existe déjà et fait 80 % du job ; le client apporte le reste (dialogue de fichier natif, notifications, multi-fenêtre). |
| Naviguer dans l'annuaire depuis un desktop                                                                                   | **Sans valeur.** Le web app est déjà un desktop app.                                                                                                                                                                                                                              |
| Mode **kiosk / mur d'affichage** pour le compte de veille                                                                    | **Piste, sans code natif** : l'app web en plein écran dans une boutique, un bureau, un événement. Le compte de veille existe déjà (`open-sources`, curation auto). À traiter séparément — et gratuitement.                                                                        |

## 3. Ce qui existe déjà (le socle)

| Brique                                                                         | État                               | Source                                |
| ------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------- |
| Web app (Next.js App Router)                                                   | ✓ en production                    | `app/`                                |
| App mobile native (équipe Flutter)                                             | en cours — prévue verte ce mois-ci | équipe mobile                         |
| **API v1** (REST + Bearer)                                                     | ✓                                  | `docs/mobile-contrats.md`             |
| Auth : Google, GitHub, OTP email                                               | ✓                                  | `docs/auth.md`                        |
| Upload binaire **multipart resumable**                                         | ✓ (chemin mobile)                  | `app/api/v1/uploads/presign/route.ts` |
| Bucket privé + presign 5 min                                                   | ✓                                  | `lib/r2.ts`                           |
| Dashboard maker (stats, revenus, builds, avis)                                 | ✓ (app Next)                       | `app/(dashboard)/`                    |
| Taxonomie plateformes (9, dont `windows`/`macos`/`linux`/`desktop`/`embarque`) | ✓                                  | `config/platforms.tsx`                |

## 4. Ce que la plateforme doit fournir (et ne fournit pas encore)

C'est **le cœur de cette note** : le client sera construit par une autre
équipe, contre notre API. Voici la liste des dépendances.

### 4.1 Ce qui suffit déjà

- **Auth** : OAuth **Google / GitHub** (navigateur système + callback) —
  l'OTP email reste le chemin mobile ; sur un desktop, un code à 6 chiffres
  est pénible. Les deux providers sont déjà activables côté Supabase.
- **API v1** : le client desktop suit **exactement** `docs/mobile-contrats.md`
  (pagination keyset, idempotence, rate-limits, formes d'erreur). Pas de
  contrat parallèle.
- **Vocabulaires** : 9 plateformes, 15 types, catégories — servis par
  `GET /meta`, jamais hardcodés côté client.
- **Upload** : notre multipart resumable (zéro RAM serveur) se réutilise
  tel quel pour un binaire de 300 Mo.
- **Dashboard** : c'est une app Next → elle se ré-embarque telle quelle.

### 4.2 Ce qui manque (et n'est pas bloquant au jour 1)

| Manque                                                                                                                                                                                                           | Impact                                                                                                                                                                                                                                   | Décision attendue                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route de téléchargement structurellement APK** : binaire approuvé → presign → lien 5 min, contrat d'installation SHA-256 vérifié par le téléphone, badge « Vérifié par la revue », compteur de téléchargements | Un produit desktop n'a **pas** de binaire servi par la plateforme — sa fiche porte un **lien** (le lien de téléchargement direct est déjà autorisé hors Android). Donc le client desktop **n'a pas besoin** de ce pipeline pour exister. | Le pipeline multi-OS (Authenticode Windows, notarisation macOS, paquets Linux, compteur par plateforme, badge) est une **décision séparée et plus tard**. |
| **Compteur de téléchargements** : il compte les **APK** servis par nos routes ; un clic sur le lien de téléchargement direct d'un produit desktop est compté à part (`product_link_clicks`)                      | Le maker desktop a déjà une preuve d'usage (les clics sortants, affichés dans son dashboard)                                                                                                                                             | Statut quo, à documenter côté client.                                                                                                                     |
| **Stockage privé multi-OS**                                                                                                                                                                                      | Un bucket par OS ou un bucket avec une clé par build ?                                                                                                                                                                                   | À trancher le jour où le pipeline multi-OS existe.                                                                                                        |
| **Build desktop de la plateforme** : qui le compile, comment il est signé, mis à jour                                                                                                                            | Hors périmètre de la plateforme                                                                                                                                                                                                          | La décision de distribution (nos liens / GitHub Releases) est déjà prise : pas de store.                                                                  |

## 5. Quand ? (le déclencheur)

Le déclencheur **n'est pas calendaire**, c'est le suivant :

> **Après la mise en production du web ET du mobile** (les deux sont
> prévus pour ce mois-ci, le mobile dependant de l'avancement de l'équipe
> mobile — c'est un consommateur simple, type app de store).

Tant que le mobile n'est pas en prod, un client desktop n'a pas de
référence : ni le contrat d'API en production, ni les retours d'usage.

**Signaux qui feraient avancer le chantier** (à surveiller, pas de date) :

- des makers réclamant un besoin **spécifique desktop** (atelier) ;
- une demande explicite de l'équipe mobile d'un compagnon desktop ;
- un volume d'ateliers maker qui rendrait le dashboard web inconfortable.

## 6. Décisions déjà prises / encore ouvertes

**Déjà tranchées**

- Client **natif**, pas PWA.
- Pas de **store** : distribution par nos liens ou GitHub Releases.
- **Une seule API** (v1) pour les trois clients (web, mobile, desktop) ;
  pas de fork du dashboard, pas de contrat parallèle.
- Auth desktop : **OAuth Google/GitHub** (providers déjà là), pas d'OTP.
- Le pipeline binaire **multi-OS n'est pas un prérequis** du client
  desktop (les produits desktop restent des fiches + liens).
- Le déclencheur est la **mise en prod du web + du mobile**, pas une date.

**Encore ouvertes** (à trancher le jour où le chantier s'ouvre)

- La stack du client : **Tauri** (Rust + notre UI web ré-embarquée) vs
  Electron vs une UI native. Tauri permet de réemployer le dashboard
  tel quel — c'est l'argument principal, pas la taille du binaire.
- La mise à jour du client (canal unique, auto-update ou manuel).
- Le mode kiosk : à traiter dans le web (gratuit) ou dans le client ?
- Si et quand le pipeline binaire multi-OS doit exister (Authenticode,
  notarisation, paquets Linux) — décision indépendante de ce client.

## 7. Sources

- `docs/mobile-contrats.md` — le contrat API à suivre (source unique).
- `docs/auth.md` — providers, OTP, Bearer.
- `docs/architecture.md` — où vit quoi, RLS, jobs.
- `app/api/products/[id]/download/route.ts` — le pipeline binaire actuel
  (Android).
- `config/platforms.tsx` — la taxonomie plateformes (9).
- `../CHANGELOG.md` — l'historique livré.
