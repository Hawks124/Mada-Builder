/**
 * Adaptateur Lemon Squeezy (docs 2026 : clé Bearer + `store_id`, JSON:API).
 * Pas d'endpoint MRR : calcul documenté sur `GET /v1/subscriptions`
 * (paginé, borne 1000 lignes) — statut `active` uniquement (essais,
 * pauses, impayés, grâces et expirés exclus), `test_mode` exclu,
 * prix standard/package uniquement (`usage_aggregation` exclu,
 * graduated/volume exclus — montants non déterministes), `setup_fee`
 * exclu (one-shot). Devise lue sur le store (jamais devinée).
 */
import {
  RevenueFetchError,
  assertCurrency,
  assertNonNegativeInt,
  monthlyFactor,
  providerGetJson,
} from "../http";
import type { RevenueAdapter } from "../adapters";
import type { RevenueResult } from "../types";

const BASE = "https://api.lemonsqueezy.com/v1";
const MAX_ROWS = 1000;

type LsAttributes = Record<string, unknown>;
type LsItem = { id: string; attributes?: LsAttributes };
type LsList = { data?: LsItem[]; links?: { next?: string | null } };

function attrs(item: LsItem): LsAttributes {
  return item.attributes && typeof item.attributes === "object" ? item.attributes : {};
}

async function lsGet(key: string, path: string): Promise<LsList> {
  const json = (await providerGetJson(`${BASE}${path}`, {
    providerLabel: "Lemon Squeezy",
    bearer: key,
    accept: "application/vnd.api+json",
    extraHeaders: { "Content-Type": "application/vnd.api+json" },
  })) as LsList;
  if (!Array.isArray(json.data)) throw new RevenueFetchError("Lemon Squeezy : liste illisible.");
  return json;
}

function requireStoreId(config: Record<string, string>): string {
  const id = (config.storeId ?? "").trim();
  if (!/^\d+$/.test(id)) throw new RevenueFetchError("Lemon Squeezy : ID de la boutique requis.");
  return id;
}

async function getStoreCurrency(key: string, storeId: string): Promise<string> {
  const json = (await providerGetJson(`${BASE}/stores/${storeId}`, {
    providerLabel: "Lemon Squeezy",
    bearer: key,
    accept: "application/vnd.api+json",
  })) as { data?: LsItem };
  const cur = attrs(json.data ?? { id: "" }).currency;
  if (typeof cur !== "string" || !/^[A-Za-z]{3}$/.test(cur)) {
    throw new RevenueFetchError("Lemon Squeezy : devise de la boutique illisible.");
  }
  return cur.toUpperCase();
}

type PriceInfo = { monthlyPerUnit: number };

async function getPrice(
  key: string,
  cache: Map<number, PriceInfo | null>,
  priceId: number,
): Promise<PriceInfo | null> {
  const cached = cache.get(priceId);
  if (cached !== undefined) return cached;
  const json = (await providerGetJson(`${BASE}/prices/${priceId}`, {
    providerLabel: "Lemon Squeezy",
    bearer: key,
    accept: "application/vnd.api+json",
  })) as { data?: LsItem };
  const a = attrs(json.data ?? { id: "" });
  let info: PriceInfo | null = null;
  // Standard/package à montant fixe uniquement (usage/tiers exclus, documentés).
  if (
    a.usage_aggregation === null &&
    (a.scheme === "standard" || a.scheme === "package") &&
    typeof a.unit_price === "number" &&
    a.unit_price > 0 &&
    typeof a.renewal_interval_unit === "string" &&
    typeof a.renewal_interval_quantity === "number"
  ) {
    const factor = monthlyFactor(a.renewal_interval_unit, a.renewal_interval_quantity);
    if (factor !== null) info = { monthlyPerUnit: (a.unit_price as number) * factor };
  }
  cache.set(priceId, info);
  return info;
}

export const lemonSqueezyAdapter: RevenueAdapter = {
  async probe({ key, config }) {
    await getStoreCurrency(key, requireStoreId(config));
  },

  async fetchRevenue({ key, config }): Promise<RevenueResult> {
    const storeId = requireStoreId(config);
    const currency = await getStoreCurrency(key, storeId);
    const priceCache = new Map<number, PriceInfo | null>();
    const customers = new Set<number>();
    let total = 0;
    let rows = 0;
    let url: string | null = `/subscriptions?filter[store_id]=${storeId}&page[size]=100`;
    for (;;) {
      const page = await lsGet(key, url);
      for (const sub of page.data!) {
        rows += 1;
        if (rows > MAX_ROWS) {
          throw new RevenueFetchError(
            "Lemon Squeezy : trop d'abonnements (> 1000) — contactez-nous.",
          );
        }
        const a = attrs(sub);
        if (a.test_mode === true) continue;
        // `active` strict : essais, pauses, impayés, grâces, expirés exclus.
        if (a.status !== "active") continue;
        const first = (a.first_subscription_item ?? null) as {
          price_id?: unknown;
          quantity?: unknown;
        } | null;
        const priceId = first && typeof first.price_id === "number" ? first.price_id : null;
        const qty =
          first && typeof first.quantity === "number" && first.quantity > 0 ? first.quantity : 1;
        if (priceId === null) continue;
        const price = await getPrice(key, priceCache, priceId);
        if (!price) continue;
        total += price.monthlyPerUnit * qty;
        if (typeof a.customer_id === "number") customers.add(a.customer_id);
      }
      const next = page.links?.next;
      if (!next) break;
      // `links.next` absolu : ne garder que le chemin relatif (origine fixée).
      const path = next.startsWith("http") ? next.slice(next.indexOf("/v1/") + 3) : next;
      if (!path.startsWith("/")) break;
      url = path;
    }
    return {
      mrrCents: assertNonNegativeInt(Math.round(total), "Lemon Squeezy"),
      currency: assertCurrency(currency),
      subscriberCount: customers.size,
    };
  },
};
