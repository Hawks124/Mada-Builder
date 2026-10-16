/**
 * Vues revenus réelles (Phase 2 MRR) : snapshots DB → `RevenueView`
 * (même contrat que les mocks, qui partent). Règles : connexion révoquée
 * = masquée ; `failing` = derniers chiffres + fraîcheur réelle (le maker
 * voit l'erreur, le public voit la date) ; `badge_only` respecté partout ;
 * classement = `active` + `full` + ≥1 snapshot, groupé par devise (zéro
 * conversion) ; curated exclu du jeu.
 */
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products, revenueConnections, revenueSnapshots, users } from "@/db/schema";
import { appGradientFor, appInitialsFor } from "@/services/products.service";
import { formatSyncedLabel } from "@/components/revenue/revenue-derive";
import type { RevenueView } from "@/components/revenue/revenue-types";
import type { RevenueProviderId } from "./types";

export type RankedRevenue = {
  productId: string;
  slug: string;
  name: string;
  tagline: string;
  categoryId: string;
  lifecycle: string;
  initials: string;
  iconGradient: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  iconUrl: string | null;
  provider: RevenueProviderId;
  mrrCents: number;
  subscriberCount: number;
  lastSyncedAt: string;
  lastSyncedLabel: string;
  history: number[];
};

function toView(
  conn: {
    provider: RevenueProviderId;
    displayMode: "full" | "badge_only";
    lastSyncedAt: Date | null;
  },
  latest: { mrrCents: number; currency: string; subscriberCount: number; capturedAt: Date },
  history: number[],
): RevenueView {
  const syncedAt = conn.lastSyncedAt ?? latest.capturedAt;
  const minutesAgo = Math.max(0, Math.round((Date.now() - syncedAt.getTime()) / 60_000));
  return {
    provider: conn.provider,
    displayMode: conn.displayMode,
    mrrCents: latest.mrrCents,
    arrCents: latest.mrrCents * 12,
    activeSubscribers: latest.subscriberCount,
    currency: latest.currency,
    lastSyncedAt: syncedAt.toISOString(),
    lastSyncedLabel: formatSyncedLabel(minutesAgo),
    history,
  };
}

async function historyFor(productId: string, limit = 90): Promise<number[]> {
  const rows = await db
    .select({ mrrCents: revenueSnapshots.mrrCents })
    .from(revenueSnapshots)
    .where(eq(revenueSnapshots.productId, productId))
    .orderBy(desc(revenueSnapshots.capturedAt))
    .limit(limit);
  return rows.map((r) => r.mrrCents).reverse();
}

/** Vue fiche (null = pas de connexion visible : rien rendu, jamais de mock). */
export async function getProductRevenueView(productId: string): Promise<RevenueView | null> {
  const [conn] = await db
    .select({
      provider: revenueConnections.provider,
      displayMode: revenueConnections.displayMode,
      status: revenueConnections.status,
      lastSyncedAt: revenueConnections.lastSyncedAt,
    })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, productId))
    .limit(1);
  if (!conn || conn.status === "revoked") return null;
  const [latest] = await db
    .select({
      mrrCents: revenueSnapshots.mrrCents,
      currency: revenueSnapshots.currency,
      subscriberCount: revenueSnapshots.subscriberCount,
      capturedAt: revenueSnapshots.capturedAt,
    })
    .from(revenueSnapshots)
    .where(eq(revenueSnapshots.productId, productId))
    .orderBy(desc(revenueSnapshots.capturedAt))
    .limit(1);
  if (!latest) return null;
  return toView(conn, latest, await historyFor(productId));
}

/** Vues compactes par lot (dashboard maker : 1 requête snapshots). */
export async function getRevenueViewsForProducts(
  productIds: string[],
): Promise<Map<string, Pick<RevenueView, "provider" | "displayMode" | "mrrCents" | "currency">>> {
  const map = new Map<
    string,
    Pick<RevenueView, "provider" | "displayMode" | "mrrCents" | "currency">
  >();
  if (productIds.length === 0) return map;
  const conns = await db
    .select({
      productId: revenueConnections.productId,
      provider: revenueConnections.provider,
      displayMode: revenueConnections.displayMode,
      status: revenueConnections.status,
    })
    .from(revenueConnections)
    .where(inArray(revenueConnections.productId, productIds));
  const usable = conns.filter((c) => c.status !== "revoked");
  if (usable.length === 0) return map;
  const snaps = await db
    .select({
      productId: revenueSnapshots.productId,
      mrrCents: revenueSnapshots.mrrCents,
      currency: revenueSnapshots.currency,
    })
    .from(revenueSnapshots)
    .where(
      inArray(
        revenueSnapshots.productId,
        usable.map((c) => c.productId),
      ),
    )
    .orderBy(desc(revenueSnapshots.capturedAt));
  const latestByProduct = new Map<string, { mrrCents: number; currency: string }>();
  for (const s of snaps) {
    if (!latestByProduct.has(s.productId)) {
      latestByProduct.set(s.productId, { mrrCents: s.mrrCents, currency: s.currency });
    }
  }
  for (const c of usable) {
    const snap = latestByProduct.get(c.productId);
    if (!snap) continue;
    map.set(c.productId, {
      provider: c.provider,
      displayMode: c.displayMode,
      mrrCents: snap.mrrCents,
      currency: snap.currency,
    });
  }
  return map;
}

/** Classement par devise (zéro conversion : chaque devise son rang). */
export async function getRevenueRankingGroups(): Promise<
  { currency: string; totalMrrCents: number; count: number; items: RankedRevenue[] }[]
> {
  const rows = await db
    .select({
      productId: revenueConnections.productId,
      provider: revenueConnections.provider,
      lastSyncedAt: revenueConnections.lastSyncedAt,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      categoryId: products.category,
      lifecycle: products.lifecycle,
      iconUrl: products.iconUrl,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .innerJoin(users, eq(users.id, products.makerId))
    .where(
      and(
        eq(revenueConnections.status, "active"),
        eq(revenueConnections.displayMode, "full"),
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
      ),
    );
  const items: (RankedRevenue & { currency: string })[] = [];
  for (const r of rows) {
    const [latest] = await db
      .select({
        mrrCents: revenueSnapshots.mrrCents,
        currency: revenueSnapshots.currency,
        subscriberCount: revenueSnapshots.subscriberCount,
        capturedAt: revenueSnapshots.capturedAt,
      })
      .from(revenueSnapshots)
      .where(eq(revenueSnapshots.productId, r.productId))
      .orderBy(desc(revenueSnapshots.capturedAt))
      .limit(1);
    if (!latest) continue;
    const syncedAt = r.lastSyncedAt ?? latest.capturedAt;
    items.push({
      productId: r.productId,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      categoryId: r.categoryId,
      lifecycle: r.lifecycle,
      initials: appInitialsFor(r.name),
      iconGradient: appGradientFor(r.productId),
      makerUsername: r.makerUsername,
      makerDisplayName: r.makerDisplayName,
      makerAvatarUrl: r.makerAvatarUrl,
      iconUrl: r.iconUrl,
      provider: r.provider,
      mrrCents: latest.mrrCents,
      subscriberCount: latest.subscriberCount,
      lastSyncedAt: syncedAt.toISOString(),
      lastSyncedLabel: formatSyncedLabel(
        Math.max(0, Math.round((Date.now() - syncedAt.getTime()) / 60_000)),
      ),
      history: await historyFor(r.productId),
      currency: latest.currency,
    });
  }
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const list = groups.get(item.currency) ?? [];
    list.push(item);
    groups.set(item.currency, list);
  }
  return [...groups.entries()]
    .map(([currency, list]) => {
      list.sort((a, b) => b.mrrCents - a.mrrCents);
      return {
        currency,
        totalMrrCents: list.reduce((n, i) => n + i.mrrCents, 0),
        count: list.length,
        items: list.map((i) => ({
          productId: i.productId,
          slug: i.slug,
          name: i.name,
          tagline: i.tagline,
          categoryId: i.categoryId,
          lifecycle: i.lifecycle,
          initials: i.initials,
          iconGradient: i.iconGradient,
          makerUsername: i.makerUsername,
          makerDisplayName: i.makerDisplayName,
          makerAvatarUrl: i.makerAvatarUrl,
          iconUrl: i.iconUrl,
          provider: i.provider,
          mrrCents: i.mrrCents,
          subscriberCount: i.subscriberCount,
          lastSyncedAt: i.lastSyncedAt,
          lastSyncedLabel: i.lastSyncedLabel,
          history: i.history,
        })),
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Compteur admin : connexions actives (la sync horaire tourne dessus).
 * Le MRR agrégé multi-devises n'aurait aucun sens — l'admin pilote au
 * nombre de clés, pas à une somme fictive.
 */
export async function getActiveRevenueConnectionsCount(): Promise<number> {
  const rows = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(eq(revenueConnections.status, "active"));
  return rows.length;
}

/** Total maker (devise dominante — jamais de somme multi-devises). */
export async function getMakerRevenueTotals(makerId: string): Promise<{
  totalCents: number;
  currency: string;
  hasAnyConnection: boolean;
  hasFull: boolean;
} | null> {
  const conns = await db
    .select({
      productId: revenueConnections.productId,
      displayMode: revenueConnections.displayMode,
    })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(
      and(
        eq(products.makerId, makerId),
        eq(revenueConnections.status, "active"),
        isNull(products.deletedAt),
      ),
    );
  if (conns.length === 0) return null;
  const fullIds = conns.filter((c) => c.displayMode === "full").map((c) => c.productId);
  const views = await getRevenueViewsForProducts(fullIds);
  const byCurrency = new Map<string, number>();
  for (const v of views.values()) {
    byCurrency.set(v.currency, (byCurrency.get(v.currency) ?? 0) + v.mrrCents);
  }
  let best: { totalCents: number; currency: string } | null = null;
  for (const [currency, totalCents] of byCurrency) {
    if (!best || totalCents > best.totalCents) best = { totalCents, currency };
  }
  // Que du badge_only : total 0 mais connexion existante (le public voit
  // « montant masqué », jamais « 0 $ · revenus prouvés »). `hasFull`
  // distingue le vrai 0 (connexion full, montant affiché) du masqué.
  if (!best) return { totalCents: 0, currency: "USD", hasAnyConnection: true, hasFull: false };
  return { ...best, hasAnyConnection: true, hasFull: true };
}

/**
 * Série journalière maker (devise dominante, report du dernier connu —
 * le MRR est un stock, pas un flux : un jour sans snapshot garde la
 * veille). 1 requête snapshots + bucketing mémoire (volumes V1).
 */
export async function getMakerRevenueDaily(
  makerId: string,
  days = 30,
): Promise<{ currency: string; days: { label: string; value: number }[] } | null> {
  const totals = await getMakerRevenueTotals(makerId);
  if (!totals) return null;
  const conns = await db
    .select({ productId: revenueConnections.productId })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(
      and(
        eq(products.makerId, makerId),
        eq(revenueConnections.status, "active"),
        isNull(products.deletedAt),
      ),
    );
  if (conns.length === 0) return null;
  const since = new Date(Date.now() - (days + 2) * 86_400_000);
  const snaps = await db
    .select({
      productId: revenueSnapshots.productId,
      mrrCents: revenueSnapshots.mrrCents,
      currency: revenueSnapshots.currency,
      capturedAt: revenueSnapshots.capturedAt,
    })
    .from(revenueSnapshots)
    .where(
      and(
        inArray(
          revenueSnapshots.productId,
          conns.map((c) => c.productId),
        ),
        eq(revenueSnapshots.currency, totals.currency),
        gte(revenueSnapshots.capturedAt, since),
      ),
    )
    .orderBy(asc(revenueSnapshots.capturedAt));
  const byProduct = new Map<string, { at: number; mrr: number }[]>();
  for (const s of snaps) {
    const list = byProduct.get(s.productId) ?? [];
    list.push({ at: s.capturedAt.getTime(), mrr: s.mrrCents });
    byProduct.set(s.productId, list);
  }
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const series: { label: string; value: number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let d = days - 1; d >= 0; d--) {
    const start = today.getTime() - d * 86_400_000;
    const end = start + 86_400_000 - 1;
    let sum = 0;
    for (const list of byProduct.values()) {
      let last = 0;
      for (const p of list) {
        if (p.at <= end) last = p.mrr;
        else break;
      }
      sum += last;
    }
    series.push({ label: dayLabel.format(new Date(start)), value: sum });
  }
  return { currency: totals.currency, days: series };
}

/** Connexions en échec (monitoring admin). */ export async function getFailingRevenueConnections(): Promise<
  {
    connectionId: string;
    productId: string;
    productName: string;
    productSlug: string;
    provider: RevenueProviderId;
    lastError: string | null;
    failedCount: number;
    lastSyncedAt: string | null;
  }[]
> {
  const rows = await db
    .select({
      connectionId: revenueConnections.id,
      productId: revenueConnections.productId,
      productName: products.name,
      productSlug: products.slug,
      provider: revenueConnections.provider,
      lastError: revenueConnections.lastError,
      failedCount: revenueConnections.failedCount,
      lastSyncedAt: revenueConnections.lastSyncedAt,
    })
    .from(revenueConnections)
    .innerJoin(products, eq(products.id, revenueConnections.productId))
    .where(eq(revenueConnections.status, "failing"))
    .orderBy(desc(revenueConnections.failedCount));
  return rows.map((r) => ({
    ...r,
    lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
  }));
}
