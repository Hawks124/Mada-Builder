import { v7 as uuidv7 } from "uuid";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Verrou anti-doublon du digest hebdo (lot B) : une ligne par semaine
 * ISO — le second `sendWeeklyDigest` de la même semaine est un no-op
 * (`alreadySent: true`). La ligne sert aussi d'audit (eligible/sent de
 * la semaine). Run avorté → verrou retiré best-effort par le service ;
 * `?force=1` l'efface manuellement. RLS deny-all (setup.sql) : écritures
 * service seules.
 */
export const digestsSent = pgTable("digests_sent", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  week: text("week").notNull().unique(),
  eligible: integer("eligible").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DigestSent = typeof digestsSent.$inferSelect;
export type NewDigestSent = typeof digestsSent.$inferInsert;
