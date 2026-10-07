# Table `product_page_views`

Vues fiche — 100 % ANONYMES par schéma (aucun `user_id`, aucun IP,
aucun user-agent). Agrégats lus (dashboard maker, stats admin),
jamais de « qui a vu quoi ».

## Colonnes

| Colonne      | Type                                    | Notes                 |
| ------------ | --------------------------------------- | --------------------- |
| `id`         | `uuid` PK, UUIDv7                       |                       |
| `product_id` | `uuid` NOT NULL → `products.id` CASCADE |                       |
| `created_at` | `timestamptz` NOT NULL                  | Fenêtres 7 j / totaux |

Index : `(product_id, created_at)`.

## RLS (`setup.sql`)

- **Deny-all** : écriture service seule (beacon best-effort, jamais
  bloquant), lectures Drizzle serveur (batch engagement).

## Règles métier miroir (serveur, jamais client)

- Fiche publiée exigée (pas de remplissage sur de l'invisible).
- Best-effort silencieux (jamais de 500 pour une vue).

## Realtime

- Non publiée.

## Usage mobile

- **Ne jamais écrire directement** : les vues mobiles ne sont pas
  comptées en V1 (pas d'endpoint — documenté ici pour éviter un
  bricolage client qui fausserait les stats makers).
