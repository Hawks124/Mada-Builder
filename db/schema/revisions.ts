import { v7 as uuidv7 } from "uuid";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products";
import { users } from "./users";

/**
 * Révision en attente d'une fiche PUBLIÉE (migration 0050).
 *
 * Quand le maker modifie le contenu sensible d'une fiche en ligne (nom,
 * tagline, description, liens, tags, requirements, commande
 * d'installation) ou ses médias, la modification n'est PAS appliquée :
 * elle attend un regard admin — la fiche reste en ligne avec son contenu
 * VALIDÉ (la règle des stores : les changements ne filent pas).
 *
 * Déni-all RLS : seul le service (server-side) lit et écrit cette
 * table. Elle vivait avant dans des colonnes de `products`, lisibles par
 * la clé anonyme publique (le GRANT y est de niveau TABLE et la RLS ne
 * filtre que les LIGNES) → le contenu non validé fuitait vers quiconque
 * posait une requête directe.
 */
export const productRevisions = pgTable(
  "product_revisions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // UNE révision en cours par produit (la nouvelle remplace l'ancienne).
    productId: uuid("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    makerId: uuid("maker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Champs sensibles modifiés (valeurs nouvelles). */
    payload: jsonb("payload").notNull().default({}),
    /** Médias proposés (logo + captures) : uploadés R2, pas attachés. */
    media: jsonb("media"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    /** Motif du refus (écrit par l'admin). */
    rejectionReason: text("rejection_reason"),
  },
  (t) => [
    index("product_revisions_product_idx").on(t.productId),
    index("product_revisions_pending_idx").on(t.createdAt),
  ],
);

export type ProductRevision = typeof productRevisions.$inferSelect;
export type NewProductRevision = typeof productRevisions.$inferInsert;
