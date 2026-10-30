import { v7 as uuidv7 } from "uuid";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Filet de reprise RGPD (F4) : preuves d'appel dont la purge Storage a
 * ÉCHOUÉ à la suppression du compte (`appeals/{uid}/…` — Supabase
 * Storage n'est pas une table, la cascade SQL ne les touche pas). La
 * promesse légale (« réellement et définitivement effacés ») n'autorise
 * pas un objet laissé derrière pour une panne transitoire.
 *
 * AUCUN FK sur `owner_id` : le compte est DÉJÀ détruit quand la ligne
 * se crée — elle doit survivre à la cascade, c'est tout son intérêt.
 * Le cron maintenance hebdo re-essaie chaque entrée ; une purge aboutie
 * (listage + removes sans erreur, même sur un bucket déjà vide) la
 * retire du backlog.
 *
 * RLS deny-all : Drizzle serveur uniquement. Volume faible : une ligne
 * = un épisode de suppression raté (UNIQUE sur owner_id).
 */
export const gdprPurgeRetries = pgTable("gdpr_purge_retries", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  ownerId: uuid("owner_id").notNull().unique(),
  /** Échecs consécutifs — incrémenté à chaque reprise ratée. */
  attempts: integer("attempts").notNull().default(0),
  /** Contexte du dernier échec (message humain, jamais de secret). */
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GdprPurgeRetry = typeof gdprPurgeRetries.$inferSelect;
export type NewGdprPurgeRetry = typeof gdprPurgeRetries.$inferInsert;
