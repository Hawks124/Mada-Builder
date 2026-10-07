import { v7 as uuidv7 } from "uuid";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Clés d'idempotence API (`Idempotency-Key`, Phase 6) : un retry mobile sur
 * réseau fluctuant rejoue la PREMIÈRE réponse au lieu de ré-exécuter
 * (jamais de produit dupliqué ni de double-toggle). Ligne `status NULL` =
 * requête en vol (concurrence → 409 franc, le client réessaie puis reçoit
 * le replay). TTL 24 h, purge paresseuse (à l'accès, jamais de cron).
 * RLS deny-all : écritures service seules.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    status: integer("status"),
    body: jsonb("body").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_user_key_uniq").on(t.userId, t.key),
    index("idempotency_keys_created_idx").on(t.createdAt),
  ],
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
