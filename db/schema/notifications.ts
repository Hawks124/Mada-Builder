import { v7 as uuidv7 } from "uuid";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
 * RLS : select own (authenticated, `user_id = auth.uid()` — le Realtime
 * ne délivre que ses lignes) ; AUCUNE écriture directe (service seul).
 */
export const notificationKindEnum = pgEnum("notification_kind", [
  "product_approved",
  "product_rejected",
  "product_removed",
  "review_received",
  "comment_received",
  "comment_replied",
  "vote_milestone",
  "view_milestone",
  "appeal_decided",
  "role_changed",
  "banned",
  "unbanned",
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
