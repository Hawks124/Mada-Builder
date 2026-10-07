import { v7 as uuidv7 } from "uuid";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { desc } from "drizzle-orm";
import { users } from "./users";

/**
 * Produits — milestone products Phase 1 (§8 PRD + matrice
 * config/product-links). Statuts : draft (brouillon invisible),
 * pending (file de revue), published (public), rejected (motif requis).
 * Suppression maker = hard delete RGPD (comme users) ; `deletedAt`
 * réservé aux retraits admin (anti-liste-morte sans perte).
 *
 * Conventions : catégories = slugs texte validés Zod contre
 * config/categories (pas de table — slugs SEO stables) ; product_type =
 * ids config/product-types (+ game) ; pricing = ids config/pricing.
 * Compteurs dénormalisés (upvote_count, score) tenus en transaction
 * (votes) — le leaderboard est la requête la plus chaude.
 * Médias : URLs R2 (buckets product-logos/shots), jamais de bytes en DB.
 * Galerie = table product_screenshots (ordre) — pas de gallery_urls
 * (double source interdite).
 *
 * Liens — map field-id (matrice product-links) → URL, en JSONB.
 * UNE SEULE source (pas de colonnes par URL : 29 champs matrice pour
 * 16 colonnes = collisions avec perte — ex. Flathub vs Steam indistincts
 * dans downloadUrl). Requêtable via `->>` si besoin, validé Zod (ids
 * connus uniquement). Exemple : {"website": "https://…", "registry": …}.
 */
export type ProductLinks = Record<string, string>;

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "pending",
  "published",
  "rejected",
]);

export const productTypeEnum = pgEnum("product_type", [
  "app_mobile",
  "app_web",
  "app_desktop",
  "cli",
  "package",
  "framework",
  "api",
  "extension",
  "os",
  "iot",
  "bot",
  "plugin",
  "saas",
  "game",
  "other",
]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "free",
  "freemium",
  "paid",
  "subscription",
  "one_time_purchase",
  "open_source_donationware",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    slug: text("slug").notNull().unique(),
    makerId: uuid("maker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    // Toutes les catégories choisies ([0] = principale = category).
    // Tags libres V1 en text[] (liaisons V1.5 si besoin relationnel) —
    // jamais de perte silencieuse au submit.
    categories: text("categories").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    platforms: text("platforms").array().notNull().default([]),
    // Liens matrice (field-id → URL). Voir ProductLinks ci-dessus.
    links: jsonb("links").$type<ProductLinks>().notNull().default({}),
    productType: productTypeEnum("product_type").notNull().default("other"),
    pricingModel: pricingModelEnum("pricing_model").notNull().default("free"),
    // Cycle de vie + audience (config/lifecycle, config/ratings) : affichés
    // en pills sur la fiche (pas de table — vocabulaires fermés stables).
    lifecycle: text("lifecycle").notNull().default("live"),
    audience: text("audience").notNull().default("all"),
    license: text("license"),
    hasAds: boolean("has_ads").notNull().default(false),
    hasInAppPurchase: boolean("has_in_app_purchase").notNull().default(false),
    // Déclaration maker (toggle formulaire) : affichée en revue + fiche.
    // Ajoutée au correctif review (le toggle existait sans colonne).
    sharesData: boolean("shares_data").notNull().default(false),
    isChildDirected: boolean("is_child_directed").notNull().default(false),
    installCommand: text("install_command"),
    version: text("version"),
    requirements: text("requirements"),
    targetCountries: text("target_countries").array().notNull().default([]),
    languagesSupported: text("languages_supported").array().notNull().default([]),
    iconUrl: text("icon_url"),
    // Orientation déclarée de la galerie — pilotée par le type de produit
    // (config/product-types `orientation`), pas un choix libre : un SaaS
    // desktop en portrait n'existe pas. "both" (jeu, bot, autre) = seul
    // cas où le maker choisit. Uniformité imposée : toute capture hors
    // orientation est rejetée à l'upload, jamais recadrée ni mélangée.
    galleryOrientation: text("gallery_orientation").notNull().default("landscape"),
    status: productStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    upvoteCount: integer("upvote_count").notNull().default(0),
    score: real("score").notNull().default(0),
    // Avis (lot avis/comments) : SUM + COUNT dénormalisés (moyenne =
    // sum/count calculée, jamais de flottant stocké). Commentaires : COUNT
    // (soft-deleted exclus). Tenus en transaction (pattern recompte votes).
    ratingsSum: integer("ratings_sum").notNull().default(0),
    ratingsCount: integer("ratings_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    // Curation OSS (lot curation) : produit en veille internationale —
    // exclu du classement voté + featured (catalogue oui), votes et avis
    // désactivés, commentaires ouverts. Posé auto (compte curation) ou
    // toggle admin.
    curated: boolean("curated").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Soumission en file (draft → pending, re-soumission incluse) : base
    // du SLA 24 h (D0). `createdAt` = naissance du brouillon (jamais le
    // SLA — un brouillon de 3 jours ne doit pas naître "dépassé").
    // NULL = jamais soumis ; posé à chaque (re-)soumission.
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("products_maker_idx").on(t.makerId),
    // Curseur dashboard/mobile (maker + récence) : keyset sans tri coûteux.
    index("products_maker_updated_idx").on(t.makerId, desc(t.updatedAt), desc(t.id)),
    index("products_status_published_idx").on(t.status, t.publishedAt),
    index("products_category_idx").on(t.category),
    index("products_score_idx").on(t.score),
  ],
);

export const productScreenshots = pgTable(
  "product_screenshots",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    caption: text("caption"),
    // Orientation mesurée à l'upload (jamais choisie) + dimensions réelles
    // (sortie pipeline) : la fiche rend chaque capture dans son ratio,
    // slots uniformes dimensionnés par gallery_orientation du produit.
    orientation: text("orientation").notNull().default("landscape"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("product_screenshots_product_idx").on(t.productId, t.position)],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("votes_user_product_uniq").on(t.userId, t.productId),
    index("votes_product_idx").on(t.productId),
  ],
);

/**
 * Produit du jour (§11) — UNE ligne par date calendaire (UTC) :
 * rotation à volume variable (normal/peu/très peu) + override admin
 * (`pinned`, respecté par le job). Jamais vide par construction du
 * service (tiers + état "soyez le premier" côté UI).
 */
export const featuredProducts = pgTable(
  "featured_products",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    featuredOn: date("featured_on").notNull().unique(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("featured_products_product_idx").on(t.productId)],
);

/** Vues fiche — anonymes par schéma (comme page_views : jamais de user_id). */
export const productPageViews = pgTable(
  "product_page_views",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("product_page_views_product_created_idx").on(t.productId, t.createdAt)],
);

/**
 * Clics sortants — anonymes aussi (field-id matrice : website, playstore…).
 * Le chiffre qui compte pour les makers (dashboard). RLS deny-all, écriture
 * service seule (beacon best-effort, jamais bloquant).
 */
export const productLinkClicks = pgTable(
  "product_link_clicks",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    target: text("target").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("product_link_clicks_product_created_idx").on(t.productId, t.createdAt)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductScreenshot = typeof productScreenshots.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type FeaturedProduct = typeof featuredProducts.$inferSelect;
export type ProductPageView = typeof productPageViews.$inferSelect;
export type ProductLinkClick = typeof productLinkClicks.$inferSelect;
