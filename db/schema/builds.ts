import { v7 as uuidv7 } from "uuid";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Builds APK (D1) : historique complet des binaires par produit (rollback
 * possible, traçabilité). Un build = un upload R2 (bucket privé) + les
 * métadonnées extraites côté client (D2 remplit package/versions/certs ;
 * D1 pose l'enveloppe : clé, SHA, taille). Statut : la revue binaire est
 * bloquante (D4) — seul un build approuvé devient téléchargeable.
 * RLS deny-all : service seul (jamais de lecture/écriture directe).
 */
export const productBuilds = pgTable(
  "product_builds",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // VersionCode NULL = enregistrement brut D1 (extraction manifest en
    // D2 le remplit). Plusieurs NULL coexistent (UNIQUE ignore les NULL).
    versionCode: integer("version_code"),
    versionName: text("version_name"),
    package: text("package"),
    minSdk: integer("min_sdk"),
    targetSdk: integer("target_sdk"),
    permissions: text("permissions").array().notNull().default([]),
    certSha256: text("cert_sha256"),
    certSha1: text("cert_sha1"),
    sigScheme: text("sig_scheme"),
    // Détails d'affichage du cert principal (déclarés par le client à
    // l'upload, re-vérifiés serveur en D3) : le panneau admin n'a pas à
    // re-parser le binaire pour afficher l'identité.
    certSubjectCn: text("cert_subject_cn"),
    certSubjectO: text("cert_subject_o"),
    certKeyAlg: text("cert_key_alg"),
    certKeyBits: integer("cert_key_bits"),
    certSigAlg: text("cert_sig_alg"),
    sha256File: text("sha256_file").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    r2Key: text("r2_key").notNull(),
    whatsnew: text("whatsnew"),
    status: text("status").notNull().default("pending"),
    // Revue binaire (symétrique fiche) : motif obligatoire au rejet.
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Index PARTIEL (migration 0047) : un (produit, version_code) n'existe
    // qu'une fois dans la piste VIVANTE (en revue ou en ligne). Un build
    // REJETÉ ne verrouille plus son numéro de version → le maker peut
    // re-soumettre son APK après une correction de notes, et l'historique
    // garde le rejet.
    uniqueIndex("product_builds_product_version_uidx")
      .on(t.productId, t.versionCode)
      .where(sql`status in ('pending', 'approved')`),
    // Index PARTIEL (migration 0057) : un seul build PENDING par produit.
    // Ferme la course du pré-check `stillPending` du service (TOCTOU :
    // deux envois simultanés lisaient tous deux « rien en revue » et
    // inséraient tous deux) — la base reste l'arbitre, le service gère le
    // refus 23505 par statut de contrainte.
    uniqueIndex("product_builds_one_pending_uidx")
      .on(t.productId)
      .where(sql`status = 'pending'`),
    index("product_builds_product_created_idx").on(t.productId, t.createdAt),
  ],
);

export type ProductBuild = typeof productBuilds.$inferSelect;
export type NewProductBuild = typeof productBuilds.$inferInsert;
