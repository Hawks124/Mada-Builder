import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Compteurs emails (admin) : envoyés / livrés / échoués, total ou 7 j. */
export async function getEmailStats(days?: number): Promise<{
  sent: number;
  delivered: number;
  failed: number;
}> {
  const conditions = days !== undefined ? [gte(emailLogs.createdAt, daysAgo(days))] : [];
  const rows = await db
    .select({ status: emailLogs.status, n: sql<number>`count(*)::int` })
    .from(emailLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(emailLogs.status);
  let sent = 0;
  let delivered = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === "sent") sent += r.n;
    else if (r.status === "delivered") delivered += r.n;
    else if (r.status === "failed" || r.status === "bounced" || r.status === "complained")
      failed += r.n;
  }
  return { sent, delivered, failed };
}

/**
 * État notif par produit (Lot 3, dashboard maker) : dernier email lié
 * (templates product-*). "ok" = parti ou livré, "ko" = échoué/rejeté,
 * absent = jamais notifié. 1 requête.
 */
export async function getProductNotifStatus(
  productIds: string[],
): Promise<Record<string, "ok" | "ko">> {
  if (productIds.length === 0) return {};
  const rows = await db
    .selectDistinctOn([emailLogs.productId], {
      productId: emailLogs.productId,
      status: emailLogs.status,
    })
    .from(emailLogs)
    .where(inArray(emailLogs.productId, productIds))
    .orderBy(emailLogs.productId, desc(emailLogs.createdAt));
  const out: Record<string, "ok" | "ko"> = {};
  for (const r of rows) {
    if (!r.productId) continue;
    out[r.productId] =
      r.status === "failed" || r.status === "bounced" || r.status === "complained" ? "ko" : "ok";
  }
  return out;
}

/** Dernier email d'un template (debug admin) — non exposé en UI V1. */
export async function getLastEmailError(): Promise<{ template: string; createdAt: Date } | null> {
  const [row] = await db
    .select({ template: emailLogs.template, createdAt: emailLogs.createdAt })
    .from(emailLogs)
    .where(eq(emailLogs.status, "failed"))
    .orderBy(desc(emailLogs.createdAt))
    .limit(1);
  return row ?? null;
}
