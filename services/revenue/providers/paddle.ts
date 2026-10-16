/**
 * Adaptateur Paddle (docs 2026 : API metrics, clé `pdl_*` Bearer, permission
 * `metrics.read` dédiée). MRR lu sur `/metrics/monthly-recurring-revenue`
 * (timeseries quotidienne — dernier point), abonnés sur
 * `/metrics/active-subscribers`. Montants en plus petite unité (centimes).
 */
import { RevenueFetchError, assertCurrency, assertNonNegativeInt, providerGetJson } from "../http";
import type { RevenueAdapter } from "../adapters";
import type { RevenueResult } from "../types";

const BASE = "https://api.paddle.com";

type Datapoint = { timestamp: string; amount?: string; count?: number };
type MetricsResponse = {
  currency_code?: string;
  timeseries?: Datapoint[];
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getMetric(
  key: string,
  path: "monthly-recurring-revenue" | "active-subscribers",
): Promise<MetricsResponse> {
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86_400_000);
  // `to == from` rend une série vide : fenêtre de 3 j, dernier point lu.
  const json = (await providerGetJson(
    `${BASE}/metrics/${path}?from=${isoDay(from)}&to=${isoDay(to)}`,
    { providerLabel: "Paddle", bearer: key },
  )) as MetricsResponse;
  if (!Array.isArray(json.timeseries)) {
    throw new RevenueFetchError(
      "Paddle : métrique illisible — vérifiez la permission metrics.read de la clé.",
    );
  }
  return json;
}

function lastPoint(series: Datapoint[]): Datapoint | null {
  return series.length > 0 ? series[series.length - 1] : null;
}

export const paddleAdapter: RevenueAdapter = {
  async probe({ key }) {
    await getMetric(key, "monthly-recurring-revenue");
  },

  async fetchRevenue({ key }): Promise<RevenueResult> {
    const [mrr, subs] = await Promise.all([
      getMetric(key, "monthly-recurring-revenue"),
      getMetric(key, "active-subscribers"),
    ]);
    const point = lastPoint(mrr.timeseries!);
    if (!point || typeof point.amount !== "string" || !/^\d+$/.test(point.amount)) {
      throw new RevenueFetchError("Paddle : point MRR illisible.");
    }
    const subPoint = lastPoint(subs.timeseries!);
    return {
      mrrCents: assertNonNegativeInt(Number(point.amount), "Paddle"),
      currency: assertCurrency((mrr.currency_code ?? "USD").toUpperCase()),
      subscriberCount:
        subPoint && typeof subPoint.count === "number"
          ? assertNonNegativeInt(subPoint.count, "Paddle")
          : 0,
    };
  },
};
