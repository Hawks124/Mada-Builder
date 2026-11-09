import { apiCatch, apiOk, corsPreflight, withCache, CACHE_PRIVATE } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { requireApiUser } from "@/lib/api/auth";
import { getMakerChartSeries } from "@/services/dashboard.service";
import { getMakerRevenueDaily } from "@/services/revenue/views";

export const OPTIONS = async () => corsPreflight();

/**
 * Vue d'ensemble maker — séries journalières (30/90 j) + MRR quotidien.
 * Bearer, allowBanned (un banni garde sa lecture RGPD — le verrou UX vit
 * côté client). Non-fumeur, aucune donnée partagée entre makers.
 * Mêmes services que le web (getMakerChartSeries / getMakerRevenueDaily).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:dashboard", user.id, { window: "60 s", max: 20 });
    const url = new URL(req.url);
    const rawDays = Number(url.searchParams.get("days"));
    const days =
      Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 90 ? Math.floor(rawDays) : 90;

    const [series, mrr] = await Promise.all([
      getMakerChartSeries(user.id, days).catch(() => []),
      getMakerRevenueDaily(user.id, Math.min(days, 30)).catch(() => null),
    ]);

    return withCache(
      apiOk({
        series,
        mrr,
        generatedAt: new Date().toISOString(),
      }),
      CACHE_PRIVATE,
    );
  } catch (err) {
    return apiCatch(err, "api.v1.me.dashboard");
  }
}
