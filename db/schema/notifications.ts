import { v7 as uuidv7 } from "uuid";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { products } from "./products";

/**
 * Notifications in-app (lot notifs) : TOUT événement concernant l'user —
 * décisions (revue, modération, rôles, appels), feedback reçu (avis,
 * commentaires, réponses), milestones (votes/vues). Email et notif sont
 * JUMEAUX (même point d'émission, canaux indépendants : un email en
 * échec n'empêche jamais la notif, et inversement).
 * Textes FR PRÉ-RENDUS (stables si le produit est supprimé ensuite).
 * `read_at` = pastille non-lu (V1 : cloche + page, pas de push).
 * RLS (0059, autoportant) : select own + update own — la SEULE écriture
 * directe permise au client est `read_at` sur ses propres lignes (marque
 * lu, grant de colonnes) ; tout le reste (contenu, INSERT, DELETE) reste
 * service + triggers 0055, le Realtime ne délivre que ses lignes.
 */
export const notificationKindEnum = pgEnum("notification_kind", [
  "product_approved",
  "product_rejected",
  "product_removed",
  "build_approved",
  "build_rejected",
  "review_received",
  "comment_received",
  "comment_replied",
  "vote_milestone",
  "view_milestone",
  "appeal_decided",
  "role_changed",
  "revenue_failing",
  "banned",
  "unbanned",
  "legal_updated",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Contrat mobile FCM (0065) : `meta` porte le contexte push (milestone,
    // product_*...) ; `fcm_dispatched_at` est le verrou d'idempotence du
    // pipeline push (l'EF `send-push` stamp après envoi — cooldown_skipped
    // et no_devices SONT des terminaisons définitives, aucun retry différé).
    // Ces colonnes sont écrites par la squad mobile côté Edge Function ;
    // le web les lit et ne les stampait jamais.
    meta: jsonb("meta").notNull().default({}),
    fcmDispatchedAt: timestamp("fcm_dispatched_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
    // Idempotence milestones : index unique PARTIEL en migration custom
    // (0028 — drizzle-kit ne sérialise pas le WHERE) : un seuil = une
    // notif, jamais deux. Les décisions restent multi-événements.
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
