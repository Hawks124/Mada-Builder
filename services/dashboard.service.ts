import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { productLinkClicks, productPageViews, products, votes } from "@/db/schema";
import {
  fetchMyProducts,
  getProductsEngagement,
  isListedProduct,
  toDashboardApp,
} from "@/services/products.service";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import { getProductRanks } from "@/services/ranking.service";
import { getProductNotifStatus } from "@/services/emails.service";
import { getProductsBuildStatus } from "@/services/builds.service";
import { getRevenueViewsForProducts } from "@/services/revenue/views";

/**
 * Apps du maker pour le dashboard (page "Mes produits") : lignes +
 * engagement (4C) + rangs + notifs, enrichies. Chaque section charge
 * ses propres données via ce helper (jamais de props entre pages).
 * Incidents DB = zéros (jamais de page blanche — même règle que la home).
 */
export async function getMakerAppsDashboard(userId: string): Promise<DashboardApp[]> {
  const { items: rows } = await fetchMyProducts(userId);
  const apps = rows.filter(isListedProduct).map(toDashboardApp);
  const [engagement, ranks, notifs, builds, revenues] = await Promise.all([
    getProductsEngagement(apps.map((a) => a.id)).catch(
      (): Record<
        string,
        { views: number; clicks: number; views7d: number; clicks7d: number }
      > => ({}),
    ),
    getProductRanks(apps.map((a) => a.id)).catch((): Record<string, number> => ({})),
    getProductNotifStatus(apps.map((a) => a.id)).catch((): Record<string, "ok" | "ko"> => ({})),
    getProductsBuildStatus(apps.map((a) => a.id)).catch(
      (): Record<
        string,
        {
          hasBuilds: boolean;
          latestVersionCode: number | null;
          buildCount: number;
          hasPendingBuild: boolean;
        }
      > => ({}),
    ),
    getRevenueViewsForProducts(apps.map((a) => a.id)).catch(
      () =>
        new Map<
          string,
          {
            provider: "stripe" | "revenuecat" | "paddle" | "polar" | "lemon_squeezy";
            displayMode: "full" | "badge_only";
            mrrCents: number;
            currency: string;
          }
        >(),
    ),
  ]);
  for (const app of apps) {
    app.views = engagement[app.id]?.views ?? 0;
    app.clicks = engagement[app.id]?.clicks ?? 0;
    app.views7d = engagement[app.id]?.views7d ?? 0;
    const rank = ranks[app.id];
    if (rank !== undefined) app.topRank = rank;
    const notif = notifs[app.id];
    if (notif) app.notifStatus = notif;
    app.hasBuilds = builds[app.id]?.hasBuilds ?? false;
    app.buildCount = builds[app.id]?.buildCount ?? 0;
    app.hasPendingBuild = builds[app.id]?.hasPendingBuild ?? false;
    const revenue = revenues.get(app.id);
    if (revenue) {
      app.revenue = {
        provider: revenue.provider,
        mrrCents: revenue.mrrCents,
        currency: revenue.currency,
        displayMode: revenue.displayMode,
      };
    }
  }
  return apps;
}

export type ChartDay = {
  day: string;
  label: string;
  views: number;
  clicks: number;
  votes: number;
};

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Série journalière des produits du maker (vues, clics, votes).
 *
 * Jours sans activité remontent à 0 : la courbe garde une abscisse régulière,
 * donc les trous sont comblés ici et pas laissés au rendu.
 */
export async function getMakerChartSeries(userId: string, days = 90): Promise<ChartDay[]> {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const owned = and(eq(products.makerId, userId), isNull(products.deletedAt));
  const n = sql<number>`count(*)::int`;
  const vDay = sql<string>`to_char(${productPageViews.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const cDay = sql<string>`to_char(${productLinkClicks.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const tDay = sql<string>`to_char(${votes.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  const [viewRows, clickRows, voteRows] = await Promise.all([
    db
      .select({ day: vDay, n })
      .from(productPageViews)
      .innerJoin(products, eq(products.id, productPageViews.productId))
      .where(and(owned, gte(productPageViews.createdAt, start)))
      .groupBy(vDay),
    db
      .select({ day: cDay, n })
      .from(productLinkClicks)
      .innerJoin(products, eq(products.id, productLinkClicks.productId))
      .where(and(owned, gte(productLinkClicks.createdAt, start)))
      .groupBy(cDay),
    db
      .select({ day: tDay, n })
      .from(votes)
      .innerJoin(products, eq(products.id, votes.productId))
      .where(and(owned, gte(votes.createdAt, start)))
      .groupBy(tDay),
  ]);

  const tally = (rows: Array<{ day: string; n: number }>) => {
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(r.day, Number(r.n));
    return byDay;
  };
  const views = tally(viewRows);
  const clicks = tally(clickRows);
  const got = tally(voteRows);

  return Array.from({ length: days }, (_, i) => {
    const at = new Date(end.getTime() - (days - 1 - i) * 86_400_000);
    const key = at.toISOString().slice(0, 10);
    return {
      day: key,
      label: DAY_LABEL.format(at),
      views: views.get(key) ?? 0,
      clicks: clicks.get(key) ?? 0,
      votes: got.get(key) ?? 0,
    };
  });
}
