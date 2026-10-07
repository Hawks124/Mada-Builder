# Table `notifications`

Tout événement concernant l'utilisateur : décisions (revue, modération,
rôles, appels), feedback reçu (avis, commentaires, réponses),
milestones (votes/vues), digest. Jumelles des emails (même point
d'émission, canaux indépendants). Textes FR PRÉ-RENDUS (stables si le
produit est supprimé ensuite).

## Colonnes

| Colonne      | Type                                 | Notes                                                                                                                                                                                    |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `uuid` PK, UUIDv7                    |                                                                                                                                                                                          |
| `user_id`    | `uuid` NOT NULL → `users.id` CASCADE | Destinataire                                                                                                                                                                             |
| `kind`       | `notification_kind` NOT NULL         | Enum 12 : `product_approved/rejected/removed`, `review_received`, `comment_received/replied`, `vote_milestone`, `view_milestone`, `appeal_decided`, `role_changed`, `banned`, `unbanned` |
| `product_id` | `uuid` NULL → `products.id` SET NULL | Contexte (survit en partie si fiche supprimée : id null, titre gardé)                                                                                                                    |
| `actor_id`   | `uuid` NULL → `users.id` SET NULL    | Déclencheur (survit : « ancien admin »)                                                                                                                                                  |
| `title`      | `text` NOT NULL                      | Ex. « Tarsi a dépassé 100 votes »                                                                                                                                                        |
| `body`       | `text` NULL                          | Détail (motif de rejet…)                                                                                                                                                                 |
| `read_at`    | `timestamptz` NULL                   | NULL = non lue (pastille)                                                                                                                                                                |
| `created_at` | `timestamptz` NOT NULL               | Keyset + purge 90 j (lues uniquement)                                                                                                                                                    |

Index : `(user_id, created_at)` keyset, `(user_id, read_at)` non-lues,
unique PARTIEL `(user_id, product_id, title)` sur milestones
(idempotence : un seuil = une notif).

## RLS (`setup.sql`)

- `notifications_select_own` : `authenticated`, `auth.uid() = user_id`.
- **AUCUNE écriture directe** : `notify()` service (fail-soft, jamais
  de throw — une notif ne bloque jamais l'action métier).

## Règles métier miroir (serveur, jamais client)

- Jamais de notif à soi-même (son propre vote/commentaire).
- Milestones : seuils fixes votes 10/50/100/500/1000/5000, vues
  100/1k/10k/100k — détection après recompte exact.
- Digest hebdo : éligibles non bannis/opt-in/email réel, ≥ 1 non-lue.
  Déclenchement : `run-jobs digest` (manuel / scheduler externe à
  brancher — aucun cron intégré).

## Realtime

- **PUBLIÉE** (`supabase_realtime`) : channel `notifications:{userId}`,
  INSERT own → toast + refresh (déclencheur, silencieux si coupé).

## Usage mobile

- **Lecture directe OK** (liste keyset + `unreadCount`) **et** Realtime
  (même channel) ; écritures via `GET/PATCH /me/notifications`
  (tout-lu / par ids).
