# Table `email_logs`

Journal d'envois Resend : chaque `sendEmail` est tracé (template,
statut, corrélation webhook). Destinataire HACHÉ (SHA-256, jamais
l'email en clair — stats sans PII). Sans webhooks : « accepté/échoué
côté Resend », pas « reçu ».

## Colonnes

| Colonne          | Type                                     | Notes                                                               |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `id`             | `uuid` PK, UUIDv7                        |                                                                     |
| `template`       | `text` NOT NULL                          | Ex. `product-approved`, `otp`, `digest-weekly`                      |
| `user_id`        | `uuid` NULL → `users.id` SET NULL        | Contexte (pastille notif maker)                                     |
| `product_id`     | `uuid` NULL → `products.id` SET NULL     | Contexte fiche                                                      |
| `recipient_hash` | `text` NOT NULL                          | SHA-256 (emails triés, lowercased, joints)                          |
| `resend_id`      | `text` NULL                              | Corrélation webhooks (`email_id`)                                   |
| `status`         | `email_status` NOT NULL DEFAULT `'sent'` | Enum `sent` \| `failed` \| `delivered` \| `bounced` \| `complained` |
| `created_at`     | `timestamptz` NOT NULL                   | Fenêtres 7 j / totaux                                               |

Index : `created_at`, `(template, created_at)`, `resend_id`.

## RLS (`setup.sql`)

- **Deny-all** : écritures `sendEmail` seules, lectures Drizzle serveur
  (stats admin, état notif maker).

## Règles métier miroir (serveur, jamais client)

- Journal best-effort (jamais bloquant pour l'envoi).
- Webhooks : `delivered`/`bounced`/`complained` tracés ; `opened`/
  `clicked` IGNORÉS volontairement (pas de tracking — §16).

## Realtime

- Non publiée.

## Usage mobile

- **Jamais direct** : compteurs via cartes admin ; état notif via
  `GET /me/products` (pastille par fiche).
