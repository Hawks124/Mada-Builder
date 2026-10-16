// Revenus vérifiés (Phase 2 MRR) : formules par provider (fixtures +
// fetch mocké, jamais de réseau), chiffrement, statuts, sync en échec,
// vues honnêtement vides, tables/RLS. Makers + fiches dédiés, nettoyage
// total. Usage: npx tsx scripts/verify-revenue.ts
import "./_env";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { notifications, products, revenueConnections, revenueSnapshots, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/services/users.service";
import { monthlyFactor } from "@/services/revenue/http";
import { checkKeyFormat } from "@/services/revenue/types";
import {
  decryptRevenueKey,
  encryptRevenueKey,
  revenueCryptoConfigured,
  revenueKeyHint,
} from "@/lib/revenue-crypto";
import { REVENUE_ADAPTERS } from "@/services/revenue/providers";
import { connectRevenueConnection } from "@/services/revenue/connections";
import {
  getFailingRevenueConnections,
  getMakerRevenueTotals,
  getProductRevenueView,
  getRevenueRankingGroups,
} from "@/services/revenue/views";
import { syncRevenueHourly } from "@/services/revenue/sync";

// Clé maître éphémère si absente (jamais persistée, jamais loggée) : la
// suite teste le mécanisme, pas le secret de prod.
if (!revenueCryptoConfigured()) {
  process.env.REVENUE_KEY = randomBytes(32).toString("base64");
  console.log("NOTE: REVENUE_KEY éphémère (test du mécanisme uniquement).");
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

const TAG = `verify-revenue-${Date.now()}`;
const MAKER = "verify-revenue@example.com";

// ── Mock fetch (fixtures déterministes, réseau réel interdit ici) ──
const realFetch = globalThis.fetch;
const priceFetchCount = new Map<number, number>();
function mockFetch(routes: [string, unknown][]): void {
  globalThis.fetch = (async (url: unknown) => {
    const u = String(url);
    for (const [needle, body] of routes) {
      if (u.includes(needle)) {
        const m = u.match(/\/prices\/(\d+)/);
        if (m) priceFetchCount.set(Number(m[1]), (priceFetchCount.get(Number(m[1])) ?? 0) + 1);
        return Response.json(body);
      }
    }
    throw new Error(`fetch inattendu: ${u}`);
  }) as typeof fetch;
}
function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

async function makeUser(email: string): Promise<string> {
  const admin = createAdminClient();
  const [stale] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (stale) await deleteAccount(stale.id, stale.id);
  try {
    const listed = await admin.auth.admin.listUsers({ perPage: 100 });
    const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
    if (ghost) await admin.auth.admin.deleteUser(ghost.id);
  } catch {
    // best-effort
  }
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Revenus" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Maker verify incréable : ${created.error?.message ?? "inconnu"}`);
  }
  return created.data.user.id;
}

async function makeProduct(makerId: string, name: string): Promise<string> {
  const slug = `verify-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${TAG}`;
  const [row] = await db
    .insert(products)
    .values({
      slug,
      makerId,
      name,
      tagline: "Tagline de vérification.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  return row.id;
}

async function main(): Promise<void> {
  // 1. Mensualisation (formule unique, deux moteurs la partagent en doc).
  check("mois/1 = 1", monthlyFactor("month", 1) === 1);
  check("an/1 = 1/12", Math.abs((monthlyFactor("year", 1) ?? 0) - 1 / 12) < 1e-9);
  check("trimestre", Math.abs((monthlyFactor("month", 3) ?? 0) - 1 / 3) < 1e-9);
  check("semaine/2", Math.abs((monthlyFactor("week", 2) ?? 0) - 365.25 / 7 / 12 / 2) < 1e-9);
  check("jour", Math.abs((monthlyFactor("day", 1) ?? 0) - 365.25 / 12) < 1e-9);
  check("invalide = null", monthlyFactor("eon", 1) === null && monthlyFactor("month", 0) === null);

  // 2. Formats de clés (pré-validation, avant tout réseau).
  check("stripe rk_ ok", checkKeyFormat("stripe", "rk_live_abc") === null);
  check(
    "stripe sk_ refusé",
    (checkKeyFormat("stripe", "sk_live_abc") ?? "").includes("restreinte"),
  );
  check("stripe vide", checkKeyFormat("stripe", "  ") === "Clé requise.");
  check("paddle préfixe", checkKeyFormat("paddle", "xxx") !== null);
  check("paddle ok", checkKeyFormat("paddle", "pdl_live_apikey_01abc") === null);
  check("polar ok", checkKeyFormat("polar", "polar_oat_abc") === null);
  check("polar refusé", checkKeyFormat("polar", "pat_abc") !== null);
  check("rc/ls libres", checkKeyFormat("revenuecat", "nimporte-quoi") === null);

  // 3. Chiffrement (roundtrip + refus + hint sans secret).
  const secret = `rk_test_${TAG}_secret-value`;
  const enc = await encryptRevenueKey(secret);
  check("format v1", enc.startsWith("v1."));
  check("jamais en clair", !enc.includes(secret));
  check("roundtrip", (await decryptRevenueKey(enc)) === secret);
  check(
    "hint",
    revenueKeyHint(secret) === `…${secret.slice(-4)}` &&
      !revenueKeyHint(secret).includes(secret.slice(0, 10)),
  );
  let wrongKey = false;
  try {
    await decryptRevenueKey("v1.eA.eQ");
  } catch {
    wrongKey = true;
  }
  check("payload corrompu refusé", wrongKey);

  // 4. Stripe (fixtures : actifs + belt trialing/past_due/metered + 2 pages + devise).
  const stripeSub = (over: Record<string, unknown>) => ({
    id: "sub_x",
    status: "active",
    currency: "usd",
    customer: "cus_A",
    trial_end: null,
    discounts: [],
    items: { data: [] },
    ...over,
  });
  const price = (unit: number | null, interval = "month", count = 1) => ({
    id: "price_x",
    unit_amount: unit,
    recurring: { interval, interval_count: count },
  });
  mockFetch([
    [
      "starting_after=sub_7",
      {
        data: [
          stripeSub({
            id: "sub_8",
            customer: "cus_A",
            items: { data: [{ quantity: 1, price: price(500) }] },
          }),
        ],
        has_more: false,
      },
    ],
    [
      "/v1/subscriptions",
      {
        data: [
          stripeSub({ id: "sub_1", items: { data: [{ quantity: 2, price: price(1000) }] } }),
          stripeSub({
            id: "sub_2",
            customer: "cus_B",
            discounts: [{ coupon: { percent_off: 50 } }],
            items: { data: [{ quantity: 1, price: price(2000) }] },
          }),
          stripeSub({
            id: "sub_3",
            customer: "cus_C",
            items: { data: [{ quantity: 1, price: price(120000, "year") }] },
          }),
          stripeSub({ id: "sub_4", status: "trialing" }),
          stripeSub({ id: "sub_5", status: "past_due" }),
          stripeSub({
            id: "sub_6",
            customer: "cus_D",
            items: { data: [{ quantity: 1, price: price(null) }] },
          }),
          stripeSub({
            id: "sub_7",
            currency: "eur",
            customer: "cus_E",
            items: { data: [{ quantity: 1, price: price(2000) }] },
          }),
        ],
        has_more: true,
      },
    ],
  ]);
  const stripeRes = await REVENUE_ADAPTERS.stripe.fetchRevenue({ key: "rk_test_x", config: {} });
  // USD : 1000×2 + 2000×50% + 120000/12 + 500 = 2000+1000+10000+500.
  check("stripe MRR", stripeRes.mrrCents === 13500 && stripeRes.currency === "USD");
  check("stripe abonnés (A,B,C — D metered exclu)", stripeRes.subscriberCount === 3);
  await REVENUE_ADAPTERS.stripe.probe({ key: "rk_test_x", config: {} });
  check("stripe probe ok", true);
  restoreFetch();

  // 5. Paddle (timeseries : dernier point).
  mockFetch([
    [
      "/metrics/monthly-recurring-revenue",
      {
        currency_code: "USD",
        timeseries: [
          { timestamp: "2026-10-10", amount: "12000" },
          { timestamp: "2026-10-11", amount: "12100" },
        ],
      },
    ],
    [
      "/metrics/active-subscribers",
      {
        timeseries: [
          { timestamp: "2026-10-10", count: 2 },
          { timestamp: "2026-10-11", count: 4 },
        ],
      },
    ],
  ]);
  const paddleRes = await REVENUE_ADAPTERS.paddle.fetchRevenue({ key: "pdl_live_x", config: {} });
  check("paddle MRR (dernier point)", paddleRes.mrrCents === 12100 && paddleRes.currency === "USD");
  check("paddle abonnés", paddleRes.subscriberCount === 4);
  restoreFetch();

  // 6. Polar (scan exact + repli liste).
  mockFetch([["/v1/metrics/", { mrr: 5000, active_subscriptions: 7, currency: "EUR" }]]);
  const polarRes = await REVENUE_ADAPTERS.polar.fetchRevenue({ key: "polar_oat_x", config: {} });
  check(
    "polar exact",
    polarRes.mrrCents === 5000 && polarRes.currency === "EUR" && polarRes.subscriberCount === 7,
  );
  restoreFetch();
  mockFetch([
    ["/v1/metrics/", { data: { monthly_recurring_revenue: 3000 } }],
    ["/v1/subscriptions/", { pagination: { total_count: 9 } }],
  ]);
  const polarFallback = await REVENUE_ADAPTERS.polar.fetchRevenue({
    key: "polar_oat_x",
    config: {},
  });
  check(
    "polar repli (contient + liste)",
    polarFallback.mrrCents === 3000 && polarFallback.subscriberCount === 9,
  );
  restoreFetch();

  // 7. Lemon Squeezy (statuts, test_mode, usage/tiers exclus, cache prix).
  const lsBase = {
    store_id: 9,
    customer_id: 5,
    status: "active",
    test_mode: false,
    first_subscription_item: { id: 1, subscription_id: 1, price_id: 11, quantity: 2 },
  };
  const lsSub = (id: string, attributes: Record<string, unknown>) => ({
    id,
    attributes: { ...lsBase, ...attributes },
  });
  mockFetch([
    [
      "page[number]=2",
      {
        data: [
          lsSub("7", {
            customer_id: 6,
            first_subscription_item: { id: 2, subscription_id: 7, price_id: 11, quantity: 1 },
          }),
        ],
        links: {},
      },
    ],
    [
      "/v1/subscriptions",
      {
        data: [
          lsSub("1", {}),
          lsSub("2", { status: "on_trial", first_subscription_item: null }),
          lsSub("3", { test_mode: true }),
          lsSub("4", {
            first_subscription_item: { id: 4, subscription_id: 4, price_id: 12, quantity: 1 },
          }),
          lsSub("5", {
            first_subscription_item: { id: 5, subscription_id: 5, price_id: 13, quantity: 1 },
          }),
          lsSub("6", { status: "cancelled" }),
        ],
        links: {
          next: "https://api.lemonsqueezy.com/v1/subscriptions?filter[store_id]=9&page[number]=2",
        },
      },
    ],
    [
      "/v1/prices/11",
      {
        data: {
          id: "11",
          attributes: {
            usage_aggregation: null,
            scheme: "standard",
            unit_price: 1000,
            renewal_interval_unit: "month",
            renewal_interval_quantity: 1,
          },
        },
      },
    ],
    [
      "/v1/prices/12",
      {
        data: {
          id: "12",
          attributes: {
            usage_aggregation: "sum",
            scheme: "standard",
            unit_price: null,
            renewal_interval_unit: "month",
            renewal_interval_quantity: 1,
          },
        },
      },
    ],
    [
      "/v1/prices/13",
      {
        data: {
          id: "13",
          attributes: {
            usage_aggregation: null,
            scheme: "graduated",
            unit_price: 500,
            renewal_interval_unit: "month",
            renewal_interval_quantity: 1,
          },
        },
      },
    ],
    ["/v1/stores/9", { data: { id: "9", attributes: { currency: "USD" } } }],
  ]);
  priceFetchCount.clear();
  const lsRes = await REVENUE_ADAPTERS.lemon_squeezy.fetchRevenue({
    key: "ls_key",
    config: { storeId: "9" },
  });
  // Actifs standard : 1000×2 + 1000×1. Essai, test, usage, graduated, grâce exclus.
  check("ls MRR", lsRes.mrrCents === 3000 && lsRes.currency === "USD");
  check("ls abonnés distincts", lsRes.subscriberCount === 2);
  check("ls prix en cache (3 ids distincts)", priceFetchCount.size === 3);
  restoreFetch();

  // 8. RevenueCat (overview + échec franc).
  mockFetch([
    [
      "/metrics/overview",
      {
        currency: "eur",
        metrics: [
          { id: "mrr", value: 200.5 },
          { id: "actives", value: 6 },
        ],
      },
    ],
  ]);
  const rcRes = await REVENUE_ADAPTERS.revenuecat.fetchRevenue({
    key: "rc_key",
    config: { projectId: "proj_1" },
  });
  check("rc MRR (unités→centimes)", rcRes.mrrCents === 20050 && rcRes.currency === "EUR");
  check("rc abonnés", rcRes.subscriberCount === 6);
  restoreFetch();
  mockFetch([["/metrics/overview", { currency: "USD", metrics: [{ id: "arr", value: 1 }] }]]);
  let rcMissing = false;
  try {
    await REVENUE_ADAPTERS.revenuecat.fetchRevenue({ key: "rc_key", config: { projectId: "p" } });
  } catch {
    rcMissing = true;
  }
  check("rc métrique absente = échec franc", rcMissing);
  restoreFetch();
  let rcNoProject = false;
  try {
    await REVENUE_ADAPTERS.revenuecat.probe({ key: "rc_key", config: {} });
  } catch {
    rcNoProject = true;
  }
  check("rc sans project_id refusé avant réseau", rcNoProject);

  // 9. DB : tables, contraintes, vues vides honnêtes.
  const tables = await db.execute(
    (await import("drizzle-orm"))
      .sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('revenue_connections','revenue_snapshots')`,
  );
  check("tables présentes", (tables as unknown[]).length === 2);
  check(
    "fiche sans connexion = null",
    (await getProductRevenueView("00000000-0000-0000-0000-000000000000").catch(() => "err")) ===
      null,
  );
  check("classement vide honnête", (await getRevenueRankingGroups()).length === 0);

  // 10. Connexion refusée (fausse clé) : rien stocké.
  const maker = await makeUser(MAKER);
  const prod = await makeProduct(maker, "Revenus Syrup");
  let connectThrew = false;
  try {
    await connectRevenueConnection(maker, {
      productId: prod,
      provider: "stripe",
      key: "rk_test_invalide",
      config: {},
      displayMode: "full",
    });
  } catch {
    connectThrew = true;
  }
  check("probe refusée = throw", connectThrew);
  const [leaked] = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, prod))
    .limit(1);
  check("rien stocké après refus", !leaked);

  // 11. Sync en échec (clé pourrie chiffrée) : 2 runs → failing + notif, 0 snapshot.
  const badEnc = await encryptRevenueKey("polar_oat_pourri");
  await db.insert(revenueConnections).values({
    productId: prod,
    provider: "polar",
    encryptedKey: badEnc,
    keyHint: "…urri",
    config: {},
    displayMode: "full",
    status: "active",
  });
  const r1 = await syncRevenueHourly();
  const r2 = await syncRevenueHourly();
  check("sync compte les échecs", r1.failed === 1 && r2.failed === 1);
  const [conn] = await db
    .select({ status: revenueConnections.status, failedCount: revenueConnections.failedCount })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, prod))
    .limit(1);
  check("failing après 2 échecs", conn?.status === "failing" && conn?.failedCount === 2);
  const [notif] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, maker), eq(notifications.kind, "revenue_failing" as never)))
    .limit(1);
  check("notif maker émise", !!notif);
  check("totaux maker vides honnêtes", (await getMakerRevenueTotals(maker)) === null);
  const failing = await getFailingRevenueConnections();
  check(
    "monitoring admin voit l'échec",
    failing.some((f) => f.productId === prod),
  );

  // 12. Nettoyage : fiche (cascade connexions/snapshots), makers.
  await db.delete(products).where(eq(products.makerId, maker));
  const [leftConn] = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, prod))
    .limit(1);
  check("cascade fiche → connexion", !leftConn);
  await deleteAccount(maker, maker);

  // 13. Guides : 6 docs, sommaire non vide, ancre deep-link partout.
  const { getGuideDoc } = await import("@/lib/guides");
  const hub = await getGuideDoc("revenus-verifies");
  check("guide hub", !!hub && hub.headings.length > 0);
  for (const slug of ["stripe", "revenuecat", "paddle", "polar", "lemon-squeezy"]) {
    const doc = await getGuideDoc(slug);
    check(
      `guide ${slug} + ancre creer-la-cle`,
      !!doc && doc.headings.length > 0 && doc.headings.some((h) => h.id === "creer-la-cle"),
    );
  }
  check("guide inconnu = null", (await getGuideDoc("nope")) === null);

  // 14. Toggle d'affichage + cas badge_only (sans reconnecter).
  const maker2 = await makeUser(`verify-revenue-2-${Date.now()}@example.com`);
  const prod2 = await makeProduct(maker2, "Revenus Masques");
  const enc2 = await encryptRevenueKey("rk_test_toggle");
  await db.insert(revenueConnections).values({
    productId: prod2,
    provider: "stripe",
    encryptedKey: enc2,
    keyHint: "…ggle",
    config: {},
    displayMode: "badge_only",
    status: "active",
  });
  await db.insert(revenueSnapshots).values({
    productId: prod2,
    mrrCents: 5000,
    currency: "USD",
    subscriberCount: 2,
    capturedHour: new Date(new Date().setUTCMinutes(0, 0, 0)),
  });
  const { setRevenueDisplayMode } = await import("@/services/revenue/connections");
  await setRevenueDisplayMode(
    maker2,
    (
      await db
        .select({ id: revenueConnections.id })
        .from(revenueConnections)
        .where(eq(revenueConnections.productId, prod2))
        .limit(1)
    )[0].id,
    "full",
  );
  const [toggled] = await db
    .select({
      displayMode: revenueConnections.displayMode,
      encryptedKey: revenueConnections.encryptedKey,
    })
    .from(revenueConnections)
    .where(eq(revenueConnections.productId, prod2))
    .limit(1);
  check(
    "toggle sans toucher la clé",
    toggled?.displayMode === "full" && (toggled?.encryptedKey ?? "") !== "",
  );
  const totalsFull = await getMakerRevenueTotals(maker2);
  check(
    "full : hasFull vrai (profil affiche le chiffre, même à 0)",
    totalsFull !== null && totalsFull.hasFull === true && totalsFull.totalCents === 5000,
  );
  await setRevenueDisplayMode(
    maker2,
    (
      await db
        .select({ id: revenueConnections.id })
        .from(revenueConnections)
        .where(eq(revenueConnections.productId, prod2))
        .limit(1)
    )[0].id,
    "badge_only",
  );
  const totals2 = await getMakerRevenueTotals(maker2);
  check(
    "badge_only : total 0 + hasAny + hasFull faux (jamais 0$ prouvés)",
    totals2 !== null &&
      totals2.totalCents === 0 &&
      totals2.hasAnyConnection === true &&
      totals2.hasFull === false,
  );
  const view2 = await getProductRevenueView(prod2);
  check(
    "fiche badge_only (chiffre présent, mode respecté)",
    view2 !== null && view2.displayMode === "badge_only" && view2.mrrCents === 5000,
  );
  check("classement exclut badge_only", (await getRevenueRankingGroups()).length === 0);
  await db.delete(products).where(eq(products.makerId, maker2));
  await deleteAccount(maker2, maker2);

  // 15. Cron : méthodes + garde secret.
  const cron = await import("@/app/api/cron/revenue/route");
  const cronGet = await cron.GET();
  check("cron GET = 405", cronGet.status === 405);
  const savedCron = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const cronNoSecret = await cron.POST(new Request("https://x.test/", { method: "POST" }));
  check("cron sans secret = 503", cronNoSecret.status === 503);
  process.env.CRON_SECRET = "verify-cron-secret";
  const cronForbidden = await cron.POST(
    new Request("https://x.test/", { method: "POST", headers: { authorization: "Bearer wrong" } }),
  );
  check("cron mauvais Bearer = 403", cronForbidden.status === 403);
  const cronOk = await cron.POST(
    new Request("https://x.test/", {
      method: "POST",
      headers: { authorization: "Bearer verify-cron-secret" },
    }),
  );
  const cronBody = (await cronOk.json()) as { ok: boolean };
  check("cron Bearer ok = 200", cronOk.status === 200 && cronBody.ok === true);
  if (savedCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedCron;

  console.log(`\nrevenue: ${pass} OK, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  restoreFetch();
  console.error("verify-revenue crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
