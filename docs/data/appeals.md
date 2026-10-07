# Table `appeals`

Appels de ban : un banni conteste (explication + pièces), l'admin
tranche (`upheld` = maintien, `overturned` = débanni). Un seul appel
en cours, 24 h entre dépôts. Pièces dans le bucket `appeals` PRIVÉ
(chemins stockés, URLs signées 72 h à la volée, jamais persistées).

## Colonnes

| Colonne          | Type                                         | Notes                                             |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| `id`             | `uuid` PK, UUIDv7                            |                                                   |
| `user_id`        | `uuid` NOT NULL → `users.id` CASCADE         | Appelant (banni)                                  |
| `ban_reason`     | `text` NOT NULL                              | Copie du motif au dépôt                           |
| `explanation`    | `text` NOT NULL                              | 10–2000 signes                                    |
| `evidence_paths` | `text[]` NOT NULL DEFAULT `{}`               | Chemins `appeals/`, PNG/JPG/WebP/PDF ≤ 10 Mo ×0–3 |
| `status`         | `appeal_status` NOT NULL DEFAULT `'pending'` | Enum `pending` \| `upheld` \| `overturned`        |
| `seq`            | `integer` NOT NULL                           | Rang « Appel nºX », figé (UNIQUE par user)        |
| `reviewed_at`    | `timestamptz` NULL                           | Tranché le                                        |
| `created_at`     | `timestamptz` NOT NULL                       |                                                   |

Contraintes : `UNIQUE(user_id, seq)` ; index `(user_id, created_at)`,
`(status, created_at)`.

## RLS (`setup.sql`)

- `appeals_select_staff` : lecture staff uniquement.
- **AUCUNE écriture directe** (dépôt = `POST /appeals` multipart,
  tranche = staff + audit + notif + email).

## Règles métier miroir (serveur, jamais client)

- Banni uniquement ; pending unique ; 24 h entre dépôts.
- Tranche : débanni ou maintien + notif + email (best-effort).

## Realtime

- **PUBLIÉE** : watcher file admin (INSERT → toast + refresh staff).

## Usage mobile

- **Lecture** : `GET /appeals/mine` (`{ eligible, message }`, toujours
  200 — griser le bouton + afficher le message).
- **Écriture** : `POST /appeals` (multipart `explanation` + `evidence`
  ×0–3). Détail staff : jamais mobile.
