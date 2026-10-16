/**
 * Adaptateur RevenueCat (docs 2026 : API v2, clé secrète v2 + permissions
 * `charts_metrics:charts:read` + `charts_metrics:overview:read`, `project_id`
 * requis). MRR lu sur les métriques officielles (aucun calcul maison) :
 * `overview` (point-in-time) + graphe `mrr` pour la fraîcheur. Essais et
 * impayés exclus par construction (métriques payants uniquement).
 */
import { RevenueFetchError, assertCurrency, assertNonNegativeInt, providerGetJson } from "../http";
import type { RevenueAdapter } from "../adapters";
import type { RevenueResult } from "../types";

const BASE = "https://api.revenuecat.com/v2";

type OverviewMetric = { id: string; value: number };
type OverviewResponse = { currency?: string; metrics?: OverviewMetric[] };

function requireProjectId(config: Record<string, string>): string {
  const id = (config.projectId ?? "").trim();
  if (id === "") throw new RevenueFetchError("RevenueCat : ID du projet requis.");
  return id;
}

function pickMetric(metrics: OverviewMetric[], candidates: string[]): OverviewMetric | null {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  for (const id of candidates) {
    const m = byId.get(id);
    if (m && typeof m.value === "number" && Number.isFinite(m.value)) return m;
  }
  return null;
}

async function getOverview(key: string, projectId: string): Promise<OverviewResponse> {
  const json = (await providerGetJson(`${BASE}/projects/${projectId}/metrics/overview`, {
    providerLabel: "RevenueCat",
    bearer: key,
  })) as OverviewResponse;
  if (!Array.isArray(json.metrics)) {
    throw new RevenueFetchError(
      "RevenueCat : métriques illisibles — vérifiez la clé v2 et ses permissions.",
    );
  }
  return json;
}

export const revenueCatAdapter: RevenueAdapter = {
  async probe({ key, config }) {
    // Valide clé v2 + permissions charts + project_id d'un coup.
    await getOverview(key, requireProjectId(config));
  },

  async fetchRevenue({ key, config }): Promise<RevenueResult> {
    const projectId = requireProjectId(config);
    const overview = await getOverview(key, projectId);
    const mrr = pickMetric(overview.metrics!, ["mrr", "monthly_recurring_revenue"]);
    if (!mrr) {
      throw new RevenueFetchError(
        "RevenueCat : métrique MRR introuvable — vérifiez les permissions charts de la clé.",
      );
    }
    const actives = pickMetric(overview.metrics!, ["actives", "active_subscriptions"]);
    // L'API exprime les montants en unités (pas en centimes) : conversion
    // explicite et unique (×100, arrondi).
    return {
      mrrCents: assertNonNegativeInt(Math.round(mrr.value * 100), "RevenueCat"),
      currency: assertCurrency((overview.currency ?? "USD").toUpperCase()),
      subscriberCount: actives ? assertNonNegativeInt(Math.round(actives.value), "RevenueCat") : 0,
    };
  },
};
