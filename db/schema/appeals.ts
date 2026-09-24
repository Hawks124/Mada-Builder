import { v7 as uuidv7 } from "uuid";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Appels de ban — un banni conteste avec explication + pièces. L'admin
 * tranche (upheld = maintien, overturned = débanni). appealsCount sur
 * users reste le compteur d'affichage (incrémenté au dépôt).
 * RLS deny-all (setup.sql) : tout passe par le service (service_role).
 */
export const appealStatusEnum = pgEnum("appeal_status", ["pending", "upheld", "overturned"]);

export const appeals = pgTable(
  "appeals",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Motif du ban (copie au dépôt — le motif peut changer ensuite).
    banReason: text("ban_reason").notNull(),
    explanation: text("explanation").notNull(),
    // Chemins storage (bucket `appeals` privé) — jamais d'URLs signées
    // persistées (expirent) : signées à la volée côté admin.
    evidencePaths: text("evidence_paths").array().notNull().default([]),
    status: appealStatusEnum("status").notNull().default("pending"),
    // Rang de l'appel pour ce user (Appel nºX) — figé au dépôt (jamais
    // recalculé : une décision ne renumérote pas les autres). Unique par
    // user (le rate limit rend la collision quasi impossible ; la
    // contrainte la rend impossible).
    seq: integer("seq").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("appeals_user_created_idx").on(t.userId, t.createdAt),
    index("appeals_status_created_idx").on(t.status, t.createdAt),
    uniqueIndex("appeals_user_seq_uniq").on(t.userId, t.seq),
  ],
);

export type Appeal = typeof appeals.$inferSelect;
export type NewAppeal = typeof appeals.$inferInsert;
