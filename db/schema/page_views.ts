import { v7 as uuidv7 } from "uuid";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Compteur de visites in-app — 100 % ANONYME par construction : aucun
 * user_id, aucun IP, aucun user-agent (hits bruts : path + instant).
 * Alimente les stats admin ("Visites", homepage). La notice ("mesure
 * d'audience anonyme") et la politique (§ Cookies) sont vraies par
 * schéma, pas par promesse — vérifiable en open source (priorité n°2).
 * Les vues PAR PRODUIT (fiche détail) viendront au milestone listings
 * (comptes par produit, jamais de "qui a vu quoi").
 * RLS deny-all (setup.sql) : écritures service seules, lectures Drizzle
 * serveur.
 */
export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // Chemin normalisé (sans query) — ex. "/", "/makers/kaliana".
    path: text("path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("page_views_path_created_idx").on(t.path, t.createdAt),
    index("page_views_created_idx").on(t.createdAt),
  ],
);

export type PageView = typeof pageViews.$inferSelect;
export type NewPageView = typeof pageViews.$inferInsert;
