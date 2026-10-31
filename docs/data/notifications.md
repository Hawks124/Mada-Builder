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
| `read_at`    | `timestamptz` NULL                   | NULL = non lue (pastille) ; marquable PAR LE PROPRIÉTAIRE via le pont 0059 (UPDATE `read_at` seule)                                                                                      |
| `created_at` | `timestamptz` NOT NULL               | Keyset + purge 90 j (lues uniquement)                                                                                                                                                    |

Index : `(user_id, created_at)` keyset, `(user_id, read_at)` non-lues,
unique PARTIEL `(user_id, product_id, title)` sur milestones
(idempotence : un seuil = une notif).

## RLS (migration 0059, autoportante — miroir `setup.sql` §3d-quater)

- `notifications_select_own` : `authenticated`, `user_id = auth.uid()`
  (le Realtime ne délivre que SES lignes, le REST aussi). Réside dans la
  migration depuis 0059 : une base qui n'applique QUE les migrations a
  un état RLS complet (avant 0059, la policy ne vivait que dans
  `setup.sql` — une base sans setup restait sans RLS : fuite inter-makers
  colmatée par 0059).
- `notifications_update_own` (0059, pont mobile) : UPDATE own —
  `USING`/`WITH CHECK` `user_id = auth.uid()`.
- **Grants (`REVOKE ALL` + re-grants deterministes)** : `SELECT` pour
  `authenticated` ; `UPDATE (read_at)` SEULE pour `authenticated` (le
  marquage « lu ») — `id/user_id/kind/product_id/actor_id/title/body/
created_at` restent hors d'atteinte, `INSERT`/`DELETE` fermés, `anon`
  ne lit rien.
- **Écritures restantes côté serveur** : `notify()` service (fail-soft,
  jamais de throw — une notif ne bloque jamais l'action métier) et les
  triggers du pont 0055.

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
  (même channel).
- **Marquage lu en direct** (0059) : `update({'read_at': nowIso}).eq('id', …).eq('user_id', moi)`
  — batch inclus (`in('id', ids)`), error 42501 seulement si on tente
  autre chose que `read_at` sur ses propres lignes. Le fallback
  `PATCH /api/v1/me/notifications` (tout-lu / par ids) reste disponible
  pour les clients qui le préfèrent.
