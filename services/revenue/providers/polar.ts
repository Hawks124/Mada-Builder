/**
 * Adaptateur Polar (docs 2026 : OAT `polar_oat_*` Bearer, scopes
 * `metrics:read` + `subscriptions:read`, montants en centimes).
 * MRR lu sur `/v1/metrics/` (scan défensif des slugs : match exact `mrr`
 * préféré, sinon premier slug contenant `mrr` — échec franc si absent,
 * jamais de chiffre deviné). Abonnés : même scan (`active_subscriptions`
 * …), repli = comptage `/v1/subscriptions/` (total_count).
 */
import { RevenueFetchError, assertCurrency, assertNonNegativeInt, providerGetJson } from "../http";
import type { RevenueAdapter } from "../adapters";
import type { RevenueResult } from "../types";

const BASE = "https://api.polar.sh/v1";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/** Balaye un objet de métriques : exact d'abord, sous-chaîne ensuite. */
function scanMetric(root: unknown, candidates: string[]): { slug: string; value: number } | null {
  const flat = new Map<string, number>();
  const walk = (node: unknown): void => {
    const rec = asRecord(node);
    if (!rec) return;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "number" && Number.isFinite(v)) flat.set(k.toLowerCase(), v);
      else if (typeof v === "object" && v !== null) walk(v);
    }
  };
  walk(root);
  for (const c of candidates) {
    const hit = flat.get(c.toLowerCase());
    if (hit !== undefined) return { slug: c, value: hit };
  }
  for (const c of candidates) {
    for (const [k, v] of flat) {
      if (k.includes(c.toLowerCase())) return { slug: k, value: v };
    }
  }
  return null;
}

async function getMetrics(key: string): Promise<unknown> {
  return providerGetJson(`${BASE}/metrics/`, { providerLabel: "Polar", bearer: key });
}

export const polarAdapter: RevenueAdapter = {
  async probe({ key }) {
    await getMetrics(key);
  },

  async fetchRevenue({ key }): Promise<RevenueResult> {
    const metrics = await getMetrics(key);
    const mrr = scanMetric(metrics, ["mrr", "monthly_recurring_revenue"]);
    if (!mrr) {
      throw new RevenueFetchError("Polar : métrique MRR introuvable dans la réponse.");
    }
    let subscribers = scanMetric(metrics, [
      "active_subscriptions",
      "actives",
      "active_subscribers",
      "subscription_count",
    ]);
    if (!subscribers) {
      // Repli documenté : total paginé des abonnements (borne explicite).
      const page = (await providerGetJson(`${BASE}/subscriptions/?limit=1`, {
        providerLabel: "Polar",
        bearer: key,
      })) as { pagination?: { total_count?: number } };
      const total = page.pagination?.total_count;
      if (typeof total !== "number") {
        throw new RevenueFetchError("Polar : abonnés illisibles (métriques + liste).");
      }
      subscribers = { slug: "subscriptions.list", value: total };
    }
    const rec = asRecord(metrics);
    const currency =
      typeof rec?.currency === "string"
        ? rec.currency
        : typeof (asRecord(rec?.totals) ?? {})["currency"] === "string"
          ? String((asRecord(rec?.totals) ?? {})["currency"])
          : "USD";
    return {
      mrrCents: assertNonNegativeInt(Math.round(mrr.value), "Polar"),
      currency: assertCurrency(currency.toUpperCase()),
      subscriberCount: assertNonNegativeInt(Math.round(subscribers.value), "Polar"),
    };
  },
};
