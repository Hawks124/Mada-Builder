import { v7 as uuidv7 } from "uuid";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Audit trail modération — QUI a fait QUOI à QUI et QUAND. Source des
 * compteurs ("Banni 2×") par COUNT (jamais de colonnes dénormalisées :
 * un compteur peut dériver, un journal non).
 * RLS deny-all (setup.sql) : écritures service seules (fail-soft :
 * l'audit ne bloque jamais une modération), lectures Drizzle serveur.
 * Pas de rétroactif : l'historique commence à la mise en prod (noté en UI).
 */
export const adminActionEnum = pgEnum("admin_action", [
  "ban",
  "unban",
  "promote",
  "demote",
  "appeal_upheld",
  "appeal_overturned",
]);

export type AdminActionType = (typeof adminActionEnum.enumValues)[number];

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // Nullable + SET NULL : si l'acteur supprime son compte (possible :
    // un admin peut s'auto-supprimer sauf dernier), l'événement SURVIT
    // avec acteur inconnu — un audit qui s'efface avec son auteur n'en
    // est pas un. UI : "ancien admin".
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: adminActionEnum("action").notNull(),
    // Motif de ban / vide ailleurs pour l'instant (note reviewer : V1.5).
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("admin_actions_target_created_idx").on(t.targetId, t.createdAt)],
);

export type AdminAction = typeof adminActions.$inferSelect;
export type NewAdminAction = typeof adminActions.$inferInsert;
