# product_downloads

Téléchargements APK, un événement par demande de binaire servie.

## Pourquoi une table **et** un compteur sur `products`

Les deux sont nécessaires, aucun ne suffit seul :

- **Cette table est la vérité.** Elle porte l'historique : c'est elle qui
  permet la courbe quotidienne du dashboard maker et la reconstruction du
  compteur. Un compteur seul ne peut jamais être auto-réparé ni mesuré dans le
  temps.
- **`products.download_count` est le dénominé lu à chaud.** C'est lui que le
  mobile lit **directement en base** sur la table qu'il lit déjà (aucun appel
  API nécessaire), et lui qui alimente l'agrégat plateforme de l'admin.

Le compteur est donc un **cache** : incrémenté à chaque téléchargement
(`recordDownload`, incrément atomique SQL), reconstruit depuis cette table par
le job `scores` (`recountDownloadCounts`). Il ne peut pas dériver durablement.

## Un compteur par produit, pas par version

Le chemin de téléchargement sert **toujours le dernier build approuvé**
(`/api/products/[id]/download` et `/api/v1/products/[id]/download` font tous
deux `builds[0]`). Les versions successives d'un binaire sont la même app :
compter par version compterait plusieurs fois le même produit, et le lecteur
mobile n'aurait aucune raison de s'y arrêter. Pas de `build_id` ici.

## Confidentialité

**100 % anonyme par construction** — aucun `user_id`, aucun IP, aucun
user-agent : une ligne, c'est « quelqu'un a demandé ce binaire, à cet
instant ». Aucune donnée personnelle n'est donc stockée, et la notice de
mesure anonyme reste vraie par schéma (vérifiable en open source).

## Écriture

Uniquement service-side, **fire-and-forget** : l'écriture ne retient jamais
la réponse (302 web ou JSON natif). Un téléchargement non compté est un bug
d'affichage ; un téléchargement bloqué ou en erreur est un produit mort.

Un 404 (fiche non publiée, aucun binaire approuvé) ne compte pas : le
`recordDownload` est appelé après tous les contrôles.

## RLS

**deny-all** : aucune policy → table invisible via la Data API (PostgREST).
Écritures et lectures passent par Drizzle côté serveur. Déclaré dans
`db/setup.sql` (bases neuves) et dans la migration `0045` (bases existantes,
idempotent).

## Schéma

| Colonne      | Type          | Contrainte                              |
| ------------ | ------------- | --------------------------------------- |
| `id`         | `uuid`        | PK, `gen_random_uuid()`                 |
| `product_id` | `uuid`        | FK → `products(id)` `ON DELETE CASCADE` |
| `created_at` | `timestamptz` | `DEFAULT now()`, NOT NULL               |

Index : `(product_id, created_at)` — sert le compte par produit (fenêtre 7 j
comprise) sans scan.

## Lectures

| Lecteur         | Source                       | Pourquoi                                      |
| --------------- | ---------------------------- | --------------------------------------------- |
| Dashboard maker | `product_downloads` (groupé) | total + 7 j + série du graphe                 |
| Admin           | `products.download_count`    | `SUM` plateforme, pas d'historique nécessaire |
| Mobile          | `products.download_count`    | lecture directe, sans API                     |
| API v1          | `products.download_count`    | champ `downloadCount` (parité)                |

`getProductsEngagement` (`services/products.service.ts`) expose
`downloads` / `downloads7d` ; `getMakerChartSeries` (`services/dashboard.service.ts`)
ajoute la série quotidienne.
