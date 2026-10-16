import { v7 as uuidv7 } from "uuid";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Contact plateforme (Phase 3, PRD hors V1 — sponsoring, partenariat,
 * presse, support, autre). Demandes de NON-membres possibles : aucun
 * lien user (l'email est l'identifiant). L'admin traite en file
 * (`new` → `read` → `replied` | `archived`), répond via son client
 * mail (pas de composeur stocké). Rétention 2 ans (traçabilité
 * business — même logique que le journal de modération).
 * RLS deny-all : Drizzle serveur uniquement (jamais de Data API).
 */
export const contactSubjectEnum = pgEnum("contact_subject", [
  "sponsoring",
  "partenariat",
  "presse",
  "support",
  "autre",
]);

export type ContactSubject = (typeof contactSubjectEnum.enumValues)[number];

export const contactStatusEnum = pgEnum("contact_status", ["new", "read", "replied", "archived"]);

export type ContactStatus = (typeof contactStatusEnum.enumValues)[number];

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    /** Nom de l'expéditeur (2–80, validé service). */
    name: text("name").notNull(),
    /** Email de réponse (jamais exposé en public, staff seul). */
    email: text("email").notNull(),
    subject: contactSubjectEnum("subject").notNull(),
    /** 20–2000 signes (validé service), affiché échappé côté admin. */
    message: text("message").notNull(),
    /** Lien produit/fourni optionnel (« ce produit m'intéresse »). */
    productUrl: text("product_url"),
    status: contactStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contact_messages_status_idx").on(t.status, t.createdAt),
    index("contact_messages_created_idx").on(t.createdAt),
  ],
);

export type ContactMessage = typeof contactMessages.$inferSelect;
