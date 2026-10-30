import { v7 as uuidv7 } from "uuid";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Filet RGPD « coordination uploads en vol » : à la suppression du
 * compte, la purge Storage des objets maison (avatars publics,
 * preuves d'appel privées — `appeals/{uid}/…` ne partent PAS avec la
 * cascade SQL, Supabase Storage n'est pas une table) ne peut JAMAIS
 * voir un upload démarré avant et atterri après. La ligne est donc
 * insérée SYSTÉMATIQUEMENT par `deleteAccount` (APRÈS la destruction de
 * la ligne user — jamais de re-purge d'un vivant, double barrière :
 * `runGdprBacklogPass` refuse aussi tout owner encore vivant), et le
 * cron maintenance hebdo re-passe : deux passes VIDES consécutives
 * avant retrait (~2 semaines de garde — le volume couvert est du
 * staff-side / privé, la fenêtre est tenable). Une purge aboutie
 * ou une panne storage relancent le compteur d'observation.
 *
 * AUCUN FK sur `owner_id` : le compte est DÉJÀ détruit quand la ligne
 * se crée — elle doit survivre à la cascade, c'est tout son intérêt.
 *
 * RLS deny-all : Drizzle serveur uniquement. Volume faible : une ligne
 * = un owner (UNIQUE sur owner_id, UPSERT du service).
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
