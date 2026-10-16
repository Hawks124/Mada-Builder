/**
 * Adaptateur Stripe (docs 2026 : clés restreintes `rk_`, `GET /v1/subscriptions`).
 * MRR = somme mensualisée des abonnements `active` (requête filtrée côté
 * API + ceinture côté code). Exclus : essais (`trialing`), impayés
 * (`past_due`/`unpaid`), annulés, plans gratuits, metered/tiered (montants
 * non fixes — documenté). Remises en % appliquées ; montants fixes ignorés
 * (rares, documentés). Multi-devises : périmètre de la devise dominante.
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

const BASE = "https://api.stripe.com/v1";

type StripePrice = {
  id: string;
  unit_amount: number | null;
  billing_scheme?: string;
  recurring?: { interval: string; interval_count: number } | null;
  type?: string;
};

type StripeSubscription = {
  id: string;
  status: string;
  currency: string;
  customer: string;
  trial_end?: number | null;
  items: { data: { quantity?: number; price: StripePrice }[] };
  discount?: { coupon?: { percent_off?: number } } | null;
  discounts?: ({ coupon?: { percent_off?: number } } | string)[];
};

type StripeList = { data: StripeSubscription[]; has_more: boolean };

async function getPage(key: string, startingAfter: string | null): Promise<StripeList> {
  const url =
    `${BASE}/subscriptions?status=active&limit=100&expand[]=data.price` +
    (startingAfter ? `&starting_after=${startingAfter}` : "");
  const json = (await providerGetJson(url, { providerLabel: "Stripe", bearer: key })) as StripeList;
  if (!Array.isArray(json.data) || typeof json.has_more !== "boolean") {
    throw new RevenueFetchError("Stripe : réponse abonnements illisible.");
  }
  return json;
}

function couponsPercent(sub: StripeSubscription): number {
  const all = [...(sub.discounts ?? []), ...(sub.discount ? [sub.discount] : [])];
  for (const d of all) {
    const pct = typeof d === "string" ? undefined : d.coupon?.percent_off;
    if (typeof pct === "number" && pct > 0 && pct <= 100) return pct;
  }
  return 0;
}

export const stripeAdapter: RevenueAdapter = {
  async probe({ key }) {
    // Lecture minimale : valide clé + permission Subscriptions/Read.
    await getPage(key, null);
  },

  async fetchRevenue({ key }): Promise<RevenueResult> {
    const perCurrency = new Map<string, { total: number; customers: Set<string> }>();
    let startingAfter: string | null = null;
    let pages = 0;
    for (;;) {
      pages += 1;
      if (pages > 100) throw new RevenueFetchError("Stripe : trop d'abonnements (> 10 000).");
      const page = await getPage(key, startingAfter);
      for (const sub of page.data) {
        // Ceinture : ne compter que du `active` (essais/impayés exclus).
        if (sub.status !== "active") continue;
        if (typeof sub.trial_end === "number" && sub.trial_end * 1000 > Date.now()) continue;
        const pct = couponsPercent(sub);
        for (const item of sub.items.data ?? []) {
          const price = item.price;
          const amount = price?.unit_amount;
          // Montants non fixes (metered/tiered) : exclus, documentés.
          if (typeof amount !== "number" || amount <= 0) continue;
          const rec = price.recurring;
          const factor = rec ? monthlyFactor(rec.interval, rec.interval_count) : null;
          if (factor === null) continue;
          const qty = item.quantity ?? 1;
          if (!(qty > 0)) continue;
          const monthly = amount * factor * qty * (1 - pct / 100);
          const cur = (sub.currency ?? "").toUpperCase();
          if (!/^[A-Z]{3}$/.test(cur)) continue;
          const slot = perCurrency.get(cur) ?? { total: 0, customers: new Set<string>() };
          slot.total += monthly;
          if (typeof sub.customer === "string") slot.customers.add(sub.customer);
          perCurrency.set(cur, slot);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    if (perCurrency.size === 0) {
      // Aucun abonnement facturable : MRR 0 explicite (devise USD par défaut
      // d'affichage — le snapshot porte la devise, jamais de conversion).
      return { mrrCents: 0, currency: "USD", subscriberCount: 0 };
    }
    let best: [string, { total: number; customers: Set<string> }] | null = null;
    for (const entry of perCurrency) {
      if (!best || entry[1].total > best[1].total) best = entry;
    }
    const [currency, slot] = best!;
    return {
      mrrCents: assertNonNegativeInt(Math.round(slot.total), "Stripe"),
      currency: assertCurrency(currency),
      subscriberCount: slot.customers.size,
    };
  },
};
