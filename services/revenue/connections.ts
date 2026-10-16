/**
 * Connexions revenus (Phase 2 MRR) : création (probe + chiffrement),
 * révocation (purge clé, snapshots conservés), lecture maker (sans clé).
 * Ownership strict : le maker de la fiche uniquement, fiche existante.
 */
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products, revenueConnections, revenueSnapshots } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import {
  decryptRevenueKey,
  encryptRevenueKey,
  revenueCryptoConfigured,
  revenueKeyHint,
} from "@/lib/revenue-crypto";
import { REVENUE_ADAPTERS } from "./providers";
import { checkKeyFormat, REVENUE_PROVIDER_IDS, type RevenueProviderId } from "./types";

export const connectRevenueSchema = z.object({
  productId: z.string().uuid(),
  provider: z.enum(REVENUE_PROVIDER_IDS as [RevenueProviderId, ...RevenueProviderId[]]),
  key: z.string().trim().min(8).max(500),
  config: z.record(z.string(), z.string()).default({}),
  displayMode: z.enum(["full", "badge_only"]).default("full"),
});

export type ConnectRevenueInput = z.infer<typeof connectRevenueSchema>;

function checkConfig(provider: RevenueProviderId, config: Record<string, string>): void {
  if (provider === "revenuecat") {
    if ((config.projectId ?? "").trim() === "") {
      throw new ProfileError("VALIDATION", "RevenueCat : ID du projet requis.");
    }
  } else if (provider === "lemon_squeezy") {
    if (!/^\d+$/.test((config.storeId ?? "").trim())) {
      throw new ProfileError("VALIDATION", "Lemon Squeezy : ID de la boutique requis.");
    }
  } else if (Object.keys(config).length > 0) {
    throw new ProfileError("VALIDATION", "Aucune option attendue pour ce provider.");
  }
}

async function requireOwnedProduct(
  viewerId: string,
  productId: string,
): Promise<{ id: string; name: string }> {
  const [row] = await db
    .select({ id: products.id, name: products.name, makerId: products.makerId })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);
  if (!row || row.makerId !== viewerId) {
    throw new ProfileError("FORBIDDEN", "Fiche introuvable.");
  }
  return { id: row.id, name: row.name };
}

/**
 * Connecte (ou remplace) la clé d'une fiche : format → probe live →
 * chiffrement → upsert. La clé en clair ne vit que dans cet appel.
 */
export async function connectRevenueConnection(
  viewerId: string,
  input: ConnectRevenueInput,
): Promise<{ connectionId: string; provider: RevenueProviderId; keyHint: string }> {
  if (!revenueCryptoConfigured()) {
    throw new Error("Chiffrement indisponible (configuration serveur incomplète).");
  }
  const data = connectRevenueSchema.parse(input);
  const product = await requireOwnedProduct(viewerId, data.productId);
  const formatError = checkKeyFormat(data.provider, data.key);
  if (formatError) throw new ProfileError("VALIDATION", formatError);
  checkConfig(data.provider, data.config);

  // Probe live AVANT stockage : clé + permissions + config validées.
  try {
    await REVENUE_ADAPTERS[data.provider].probe({ key: data.key.trim(), config: data.config });
  } catch (e) {
    throw new ProfileError("VALIDATION", e instanceof Error ? e.message : "Provider injoignable.");
  }

  const encrypted = await encryptRevenueKey(data.key.trim());
  const hint = revenueKeyHint(data.key);
  const [row] = await db
    .insert(revenueConnections)
    .values({
      productId: product.id,
      provider: data.provider,
      encryptedKey: encrypted,
      keyHint: hint,
      config: data.config,
      displayMode: data.displayMode,
      status: "active",
      lastError: null,
      failedCount: 0,
      lastSyncedAt: null,
    })
    .onConflictDoUpdate({
      target: revenueConnections.productId,
      set: {
        provider: data.provider,
        encryptedKey: encrypted,
        keyHint: hint,
        config: data.config,
        displayMode: data.displayMode,
        status: "active",
        lastError: null,
        failedCount: 0,
        lastSyncedAt: null,
      },
    })
    .returning({ id: revenueConnections.id });
  if (!row) throw new Error("Connexion impossible pour le moment.");
  return { connectionId: row.id, provider: data.provider, keyHint: hint };
}

/**
 * Révoque : sync coupée, clé purgée (jamais conservée), snapshots
 * existants gardés (transparence de l'historique publié).
 */
export async function revokeRevenueConnection(
  viewerId: string,
  connectionId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: revenueConnections.id, productId: revenueConnections.productId })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(and(eq(revenueConnections.id, connectionId), eq(products.makerId, viewerId)))
    .limit(1);
  if (!row) throw new ProfileError("FORBIDDEN", "Connexion introuvable.");
  await db
    .update(revenueConnections)
    .set({ status: "revoked", encryptedKey: "", lastError: null, failedCount: 0 })
    .where(eq(revenueConnections.id, row.id));
}

/** Révocation par fiche (une connexion par produit — pas d'id à connaître). */
export async function revokeMyProductConnection(
  viewerId: string,
  productId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(and(eq(revenueConnections.productId, productId), eq(products.makerId, viewerId)))
    .limit(1);
  if (!row) throw new ProfileError("FORBIDDEN", "Connexion introuvable.");
  await revokeRevenueConnection(viewerId, row.id);
}

/**
 * Bascule d'affichage (full ↔ badge seul) sans reconnecter : la clé ne
 * bouge pas, seul le mode change (revalidation fiche + classement).
 */
export async function setRevenueDisplayMode(
  viewerId: string,
  connectionId: string,
  displayMode: "full" | "badge_only",
): Promise<void> {
  const [row] = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(and(eq(revenueConnections.id, connectionId), eq(products.makerId, viewerId)))
    .limit(1);
  if (!row) throw new ProfileError("FORBIDDEN", "Connexion introuvable.");
  await db.update(revenueConnections).set({ displayMode }).where(eq(revenueConnections.id, row.id));
}

/** Connexions du maker (dashboard/api — clé jamais incluse). */
export async function listMyRevenueConnections(viewerId: string): Promise<
  {
    id: string;
    provider: RevenueProviderId;
    productId: string;
    productName: string;
    productSlug: string;
    displayMode: "full" | "badge_only";
    status: "active" | "failing" | "revoked";
    lastError: string | null;
    lastSyncedAt: string | null;
    keyHint: string | null;
    mrrCents: number | null;
    currency: string | null;
  }[]
> {
  const rows = await db
    .select({
      id: revenueConnections.id,
      provider: revenueConnections.provider,
      productId: revenueConnections.productId,
      displayMode: revenueConnections.displayMode,
      status: revenueConnections.status,
      lastError: revenueConnections.lastError,
      lastSyncedAt: revenueConnections.lastSyncedAt,
      keyHint: revenueConnections.keyHint,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(and(eq(products.makerId, viewerId), isNull(products.deletedAt)))
    .orderBy(desc(revenueConnections.createdAt));
  const out = [];
  for (const r of rows) {
    const [snap] = await db
      .select({ mrrCents: revenueSnapshots.mrrCents, currency: revenueSnapshots.currency })
      .from(revenueSnapshots)
      .where(eq(revenueSnapshots.productId, r.productId))
      .orderBy(desc(revenueSnapshots.capturedAt))
      .limit(1);
    out.push({
      ...r,
      lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
      mrrCents: snap?.mrrCents ?? null,
      currency: snap?.currency ?? null,
    });
  }
  return out;
}

/** Statut public d'une fiche (fiche + api shell — clé jamais incluse). */
export async function getProductRevenueStatus(productId: string): Promise<{
  provider: RevenueProviderId;
  displayMode: "full" | "badge_only";
  status: "active" | "failing" | "revoked";
  lastSyncedAt: string | null;
  lastError: string | null;
} | null> {
  const [row] = await db
    .select({
      provider: revenueConnections.provider,
      displayMode: revenueConnections.displayMode,
      status: revenueConnections.status,
      lastSyncedAt: revenueConnections.lastSyncedAt,
      lastError: revenueConnections.lastError,
    })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, productId))
    .limit(1);
  if (!row) return null;
  return { ...row, lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null };
}

/** Clé déchiffrée pour la sync (serveur seul, jamais au-delà de l'appel). */
export async function decryptConnectionKey(connectionId: string): Promise<string> {
  const [row] = await db
    .select({ encryptedKey: revenueConnections.encryptedKey })
    .from(revenueConnections)
    .where(eq(revenueConnections.id, connectionId))
    .limit(1);
  if (!row || row.encryptedKey === "") throw new Error("Clé absente (révoquée ?).");
  return decryptRevenueKey(row.encryptedKey);
}
