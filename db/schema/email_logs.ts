import { v7 as uuidv7 } from "uuid";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { products } from "./products";

/**
 * Journal d'emails (Lot 5) : chaque envoi Resend est tracé (template,
 * statut, corrélation webhook). Destinataire HACHÉ (sha256, jamais
 * l'email en clair — stats sans PII). RLS deny-all (setup.sql) :
 * écritures service seules, lectures Drizzle serveur (admin).
 * Sans webhooks : statut = accepté/échoué côté Resend (pas "reçu").
 */
export const emailStatusEnum = pgEnum("email_status", [
  "sent",
  "failed",
  "delivered",
  "bounced",
  "complained",
]);

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    template: text("template").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    recipientHash: text("recipient_hash").notNull(),
    resendId: text("resend_id"),
    status: emailStatusEnum("status").notNull().default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_logs_created_idx").on(t.createdAt),
    index("email_logs_template_created_idx").on(t.template, t.createdAt),
    index("email_logs_resend_idx").on(t.resendId),
  ],
);

export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
