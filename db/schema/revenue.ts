import { v7 as uuidv7 } from "uuid";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Revenus vérifiés (Phase 2 MRR, PRD §6/§8/§12) : UNE connexion par
 * produit (un fournisseur par fiche), snapshots horaires d'agrégats.
 *
 * Règles dures (§16) : clés chiffrées au repos (AES-256-GCM côté service,
 * `lib/revenue-crypto.ts`), jamais ré-affichées, jamais loggées ; que des
 * agrégats en snapshots (MRR, devise, abonnés — jamais de PII ni de détail
 * transaction) ; suppression produit = cascade (connexion + snapshots).
 * RLS deny-all (setup.sql) : lectures/écritures Drizzle serveur uniquement.
 */
export const revenueProviderEnum = pgEnum("revenue_provider", [
  "stripe",
  "revenuecat",
  "paddle",
  "polar",
  "lemon_squeezy",
]);

export type RevenueProviderId = (typeof revenueProviderEnum.enumValues)[number];

export const revenueDisplayEnum = pgEnum("revenue_display_mode", ["full", "badge_only"]);

export const revenueStatusEnum = pgEnum("revenue_status", ["active", "failing", "revoked"]);

export const revenueConnections = pgTable(
  "revenue_connections",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    provider: revenueProviderEnum("provider").notNull(),
    /** Clé chiffrée (iv + ciphertext base64) — jamais en clair, jamais lue côté client. */
    encryptedKey: text("encrypted_key").notNull(),
    /** 4 derniers caractères (support/diagnostic — jamais la clé). */
    keyHint: text("key_hint"),
    /** Config non-secrète par provider (ex. project_id, store_id) — Zod strict côté service. */
    config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
    displayMode: revenueDisplayEnum("display_mode").notNull().default("full"),
    status: revenueStatusEnum("status").notNull().default("active"),
    /** Dernier message d'erreur sanitisé (sans secret) — affiché au maker. */
    lastError: text("last_error"),
    /** Échecs consécutifs : `failing` à 2 (email maker + alerte). */
    failedCount: integer("failed_count").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("revenue_connections_status_idx").on(t.status)],
);

export const revenueSnapshots = pgTable(
  "revenue_snapshots",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mrrCents: integer("mrr_cents").notNull(),
    /** ISO 4217 native du provider — jamais convertie (pas d'erreur de change). */
    currency: text("currency").notNull(),
    subscriberCount: integer("subscriber_count").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    /** Heure tronquée (idempotence : 1 snapshot/heure/produit). */
    capturedHour: timestamp("captured_hour", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("revenue_snapshots_product_captured_idx").on(t.productId, t.capturedAt),
    uniqueIndex("revenue_snapshots_product_hour_uidx").on(t.productId, t.capturedHour),
  ],
);

export type RevenueConnection = typeof revenueConnections.$inferSelect;
export type RevenueSnapshot = typeof revenueSnapshots.$inferSelect;
