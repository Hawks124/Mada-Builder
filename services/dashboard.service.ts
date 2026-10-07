import {
  fetchMyProducts,
  getProductsEngagement,
  isListedProduct,
  toDashboardApp,
} from "@/services/products.service";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import { getProductRanks } from "@/services/ranking.service";
import { getProductNotifStatus } from "@/services/emails.service";

/**
 * Apps du maker pour le dashboard (page "Mes produits") : lignes +
 * engagement (4C) + rangs + notifs, enrichies. Chaque section charge
 * ses propres données via ce helper (jamais de props entre pages).
 * Incidents DB = zéros (jamais de page blanche — même règle que la home).
 */
export async function getMakerAppsDashboard(userId: string): Promise<DashboardApp[]> {
  const { items: rows } = await fetchMyProducts(userId);
  const apps = rows.filter(isListedProduct).map(toDashboardApp);
  const [engagement, ranks, notifs] = await Promise.all([
    getProductsEngagement(apps.map((a) => a.id)).catch(
      (): Record<
        string,
        { views: number; clicks: number; views7d: number; clicks7d: number }
      > => ({}),
    ),
    getProductRanks(apps.map((a) => a.id)).catch((): Record<string, number> => ({})),
    getProductNotifStatus(apps.map((a) => a.id)).catch((): Record<string, "ok" | "ko"> => ({})),
  ]);
  for (const app of apps) {
    app.views = engagement[app.id]?.views ?? 0;
    app.clicks = engagement[app.id]?.clicks ?? 0;
    app.views7d = engagement[app.id]?.views7d ?? 0;
    const rank = ranks[app.id];
    if (rank !== undefined) app.topRank = rank;
    const notif = notifs[app.id];
    if (notif) app.notifStatus = notif;
  }
  return apps;
}
