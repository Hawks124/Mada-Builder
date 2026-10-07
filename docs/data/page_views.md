# Table `page_views`

Compteur de visites in-app — 100 % ANONYME par construction : aucun
`user_id`, aucun IP, aucun user-agent (hits bruts : path + instant).
La notice (« mesure d'audience anonyme ») est vraie par schéma, pas par
promesse — vérifiable en open source.

## Colonnes

| Colonne      | Type                   | Notes                                       |
| ------------ | ---------------------- | ------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7      |                                             |
| `path`       | `text` NOT NULL        | Normalisé (sans query/hash, 200 signes max) |
| `created_at` | `timestamptz` NOT NULL | Fenêtres 7 j                                |

Index : `(path, created_at)`, `created_at`.

## RLS (`setup.sql`)

- **Deny-all** : écritures service seules (`logPageView` fire-and-forget,
  jamais d'await côté page, erreurs avalées), lectures Drizzle serveur.

## Règles métier miroir (serveur, jamais client)

- Une stat ne casse jamais un rendu (best-effort silencieux).
- Hits bruts, PAS des uniques (bots et refreshes comptent — dit en UI).

## Realtime

- Non publiée.

## Usage mobile

- **Jamais direct** : pas d'endpoint (les vues mobiles ne sont pas
  comptées en V1 — documenté ici pour éviter un bricolage client).
