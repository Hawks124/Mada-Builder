/**
 * Sync horaire revenus (Phase 2 MRR) : connexions `active`, séquentielles
 * (pas de fan-out — rate limits providers), 1 snapshot/heure/produit
 * (idempotent), `failing` après 2 échecs consécutifs (notif maker +
 * Sentry). Montants invalides = refusés (jamais de chiffre pourri).
 * Alertes email non envoyées ici : Resend est en test-mode (domaine non
 * vérifié) — notif in-app + Sentry, email quand le domaine est vérifié.
 */
import { v7 as uuidv7 } from "uuid";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, revenueConnections, revenueSnapshots, users } from "@/db/schema";
import { notifyProductMaker } from "@/services/notifications.service";
import { captureError } from "@/lib/monitoring";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import {
  revenueFailingHtml,
  revenueFailingSubject,
  revenueFailingText,
} from "@/lib/email-templates/revenue-failing";
import { REVENUE_CONFIG_SPECS } from "./types";
import { decryptConnectionKey } from "./connections";
import { REVENUE_ADAPTERS } from "./providers";
import type { RevenueProviderId } from "./types";

export function truncateHour(d: Date = new Date()): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  return t;
}

function sanitizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, 300);
}

async function syncOne(
  conn: {
    id: string;
    productId: string;
    productName: string;
    provider: RevenueProviderId;
    config: Record<string, string>;
    failedCount: number;
  },
  now: Date,
): Promise<"synced" | "failed" | "newlyFailing"> {
  let key: string;
  try {
    key = await decryptConnectionKey(conn.id);
  } catch (e) {
    await markFailed(conn, sanitizeError(e));
    return (await transitionToFailing(conn)) ? "newlyFailing" : "failed";
  }
  let result;
  try {
    result = await REVENUE_ADAPTERS[conn.provider].fetchRevenue({ key, config: conn.config });
  } catch (e) {
    await markFailed(conn, sanitizeError(e));
    return (await transitionToFailing(conn)) ? "newlyFailing" : "failed";
  } finally {
    key = "";
  }
  const hour = truncateHour(now);
  // Snapshot idempotent (produit+heure) : double run = 1 ligne.
  await db
    .insert(revenueSnapshots)
    .values({
      id: uuidv7(),
      productId: conn.productId,
      mrrCents: result.mrrCents,
      currency: result.currency,
      subscriberCount: result.subscriberCount,
      capturedHour: hour,
    })
    .onConflictDoNothing({
      target: [revenueSnapshots.productId, revenueSnapshots.capturedHour],
    });
  await db
    .update(revenueConnections)
    .set({ status: "active", failedCount: 0, lastError: null, lastSyncedAt: new Date() })
    .where(eq(revenueConnections.id, conn.id));
  return "synced";
}

async function markFailed(conn: { id: string }, message: string): Promise<void> {
  const [row] = await db
    .select({ failedCount: revenueConnections.failedCount })
    .from(revenueConnections)
    .where(eq(revenueConnections.id, conn.id))
    .limit(1);
  const failed = (row?.failedCount ?? 0) + 1;
  await db
    .update(revenueConnections)
    .set({ failedCount: failed, lastError: message })
    .where(eq(revenueConnections.id, conn.id));
}

/** Bascule `failing` à 2 échecs consécutifs (+ notif maker + Sentry). */
async function transitionToFailing(conn: {
  id: string;
  productId: string;
  productName: string;
  provider: RevenueProviderId;
}): Promise<boolean> {
  const [row] = await db
    .select({ failedCount: revenueConnections.failedCount, status: revenueConnections.status })
    .from(revenueConnections)
    .where(eq(revenueConnections.id, conn.id))
    .limit(1);
  if (!row || row.failedCount < 2 || row.status !== "active") return false;
  await db
    .update(revenueConnections)
    .set({ status: "failing" })
    .where(eq(revenueConnections.id, conn.id));
  const title = `Sync revenus en échec — ${conn.productName}`;
  await notifyProductMaker(conn.productId, "revenue_failing", title);
  captureError(new Error(`revenue sync failing: ${conn.productId}`), {
    op: "revenue.sync",
    productId: conn.productId,
  });
  // Email best-effort (jamais bloquant) : motif exact + marche à suivre.
  // Resend test-mode oblige, il peut ne pas partir — la notif in-app
  // reste le canal fiable.
  try {
    const [maker] = await db
      .select({
        email: users.email,
        displayName: users.displayName,
        timeZone: users.timeZone,
      })
      .from(products)
      .innerJoin(users, eq(users.id, products.makerId))
      .where(eq(products.id, conn.productId))
      .limit(1);
    if (maker) {
      const [syncRow] = await db
        .select({ lastError: revenueConnections.lastError })
        .from(revenueConnections)
        .where(eq(revenueConnections.id, conn.id))
        .limit(1);
      const origin = siteUrl();
      await sendEmail({
        to: maker.email,
        subject: revenueFailingSubject(conn.productName),
        template: "revenue-failing",
        productId: conn.productId,
        html: revenueFailingHtml({
          displayName: maker.displayName,
          productName: conn.productName,
          providerLabel: REVENUE_CONFIG_SPECS[conn.provider].label,
          reason: syncRow?.lastError ?? "Échec de synchronisation.",
          dashboardUrl: `${origin}/dashboard/api`,
          origin,
          timeZone: maker.timeZone,
        }),
        text: revenueFailingText({
          displayName: maker.displayName,
          productName: conn.productName,
          providerLabel: REVENUE_CONFIG_SPECS[conn.provider].label,
          reason: syncRow?.lastError ?? "Échec de synchronisation.",
          dashboardUrl: `${origin}/dashboard/api`,
          origin,
          timeZone: maker.timeZone,
        }),
      });
    }
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "revenue.failingEmail" });
  }
  return true;
}

export async function syncRevenueHourly(now: Date = new Date()): Promise<{
  synced: number;
  failed: number;
  newlyFailing: number;
}> {
  const conns = await db
    .select({
      id: revenueConnections.id,
      productId: revenueConnections.productId,
      productName: products.name,
      provider: revenueConnections.provider,
      config: revenueConnections.config,
      failedCount: revenueConnections.failedCount,
    })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(and(eq(revenueConnections.status, "active")));
  let synced = 0;
  let failed = 0;
  let newlyFailing = 0;
  // Séquentiel : un provider lent ne bloque pas les autres (erreur
  // isolée par connexion), rate limits respectés.
  for (const conn of conns) {
    try {
      const r = await syncOne(
        {
          ...conn,
          config: (conn.config ?? {}) as Record<string, string>,
        },
        now,
      );
      if (r === "synced") synced += 1;
      else if (r === "newlyFailing") {
        failed += 1;
        newlyFailing += 1;
      } else failed += 1;
    } catch (e) {
      failed += 1;
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "revenue.syncOne",
        connectionId: conn.id,
      });
    }
  }
  return { synced, failed, newlyFailing };
}
