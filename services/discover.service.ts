import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { products, users, votes } from "@/db/schema";
import { PRICING_MODELS } from "@/config/pricing";
import { PRODUCT_TYPES, getProductTypeById } from "@/config/product-types";
import { PLATFORMS } from "@/config/platforms";
import { AGE_RATINGS } from "@/config/ratings";
import { PRODUCT_CATEGORIES } from "@/config/categories";
import { appGradientFor, appInitialsFor, ratingsAvgOf } from "@/services/products.service";

/**
 * Recherche /discover — MÊME contrat que `lib/discover-filters` (l'URL
 * reste l'unique source de vérité, le serveur renvoie l'état + les items).
 * Facettes : cat (1), types/platform/pricing/lifecycle/ages (multi),
 * q (plein texte FR classé par pertinence — tsvector + trigram, 4B), sort, page.
 * Sorts `comments`/`revenue` : masqués côté UI jusqu'à V1.5/MRR (jamais
 * de tri mensonger sur des zéros).
 */

export type DiscoverSort = "votes" | "newest" | "recommended";

export type DiscoverQuery = {
  cat?: string | null;
  types?: string[];
  platforms?: string[];
  pricing?: string[];
  lifecycle?: string[];
  ages?: string[];
  q?: string;
  sort?: string | null;
  page?: number;
};

export type DiscoverItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryId: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  votes: number;
  iconUrl: string | null;
  iconGradient: string;
  initials: string;
  pricingId: string;
  pricingLabel: string;
  productTypeLabel: string;
  platforms: string[];
  audienceId: string;
  lifecycle: string;
  dailyVotes: number;
  publishedAt: string;
  ratingAvg: number;
  ratingsCount: number;
  commentsCount: number;
  curated: boolean;
};

import { DISCOVER_PAGE_SIZE } from "@/lib/discover-filters";

// L'URL est déjà filtrée (discover-filters), mais le service ne fait
// confiance à personne (mobile inclus) : inconnus écartés, jamais d'erreur.
const KNOWN_TYPES = new Set(PRODUCT_TYPES.map((t) => t.id));
const KNOWN_PLATFORMS = new Set(PLATFORMS.map((p) => p.id));
const KNOWN_PRICING = new Set(PRICING_MODELS.map((p) => p.id));
const KNOWN_AUDIENCE = new Set(AGE_RATINGS.map((r) => r.id));
const KNOWN_CATEGORIES = new Set(PRODUCT_CATEGORIES.map((c) => c.id));

function keepIds(values: string[] | undefined, known: Set<string>): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  for (const v of values) if (known.has(v) && !seen.has(v)) seen.add(v);
  return [...seen];
}

/**
 * Conditions filtres + recherche (4D) : PARTAGÉES entre `searchProducts`
 * (web, offset) et `getPublicProductsFeed` (mobile, keyset). Un seul
 * endroit pour la matrice filtres/tsvector — jamais de divergence.
 * `withQuery` = false pour le flux nouveautés pur (le `q` y est ignoré,
 * pas d'erreur silencieuse de classement).
 */
export function buildDiscoverConditions(input: DiscoverQuery): SQL[] {
  const conditions: SQL[] = [eq(products.status, "published"), isNull(products.deletedAt)];
  if (input.cat && KNOWN_CATEGORIES.has(input.cat)) {
    conditions.push(sql`${input.cat} = ANY(${products.categories})`);
  }
  const types = keepIds(input.types, KNOWN_TYPES);
  if (types.length > 0) {
    conditions.push(inArray(products.productType, types as never[]));
  }
  const platforms = keepIds(input.platforms, KNOWN_PLATFORMS);
  if (platforms.length > 0) {
    conditions.push(
      sql`${products.platforms} && ARRAY[${sql.join(
        platforms.map((p) => sql`${p}`),
        sql`,`,
      )}]`,
    );
  }
  const pricing = keepIds(input.pricing, KNOWN_PRICING);
  if (pricing.length > 0) {
    conditions.push(inArray(products.pricingModel, pricing as never[]));
  }
  if (input.lifecycle && input.lifecycle.length > 0) {
    conditions.push(inArray(products.lifecycle, input.lifecycle));
  }
  const ages = keepIds(input.ages, KNOWN_AUDIENCE);
  if (ages.length > 0) {
    conditions.push(inArray(products.audience, ages));
  }
  const q = (input.q ?? "").trim();
  // 4B : plein texte FR classé par pertinence. `websearch_to_tsquery`
  // (tolérant, jamais d'erreur de syntaxe) sur le vecteur pondéré
  // (nom > tagline > description) + fallback trigram sur le nom pour les
  // fautes de frappe que le stemming ne rattrape pas.
  // `search_vector` est DB-only (GENERATED) : pas de champ Drizzle, SQL brut.
  if (q !== "") {
    const tsQuery = sql`websearch_to_tsquery('french', ${q})`;
    conditions.push(
      sql`("products"."search_vector" @@ ${tsQuery} OR similarity("products"."name", ${q}) > 0.2)`,
    );
  }
  return conditions;
}

/** Requête tsvector (rang) — même expression que la condition (4B). */
export function discoverTsQuery(q: string): SQL {
  return sql`websearch_to_tsquery('french', ${q})`;
}

export async function searchProducts(
  input: DiscoverQuery,
): Promise<{ items: DiscoverItem[]; total: number }> {
  const page = Math.max(1, input.page ?? 1);
  const offset = (page - 1) * DISCOVER_PAGE_SIZE;
  const conditions = buildDiscoverConditions(input);
  const q = (input.q ?? "").trim();
  // `tsQuery` reconstruit ici (même expression que la condition) pour le
  // tri pertinence — jamais de divergence avec le filtre.
  const tsQuery = q !== "" ? discoverTsQuery(q) : null;
  const sort: DiscoverSort =
    input.sort === "newest" ? "newest" : input.sort === "recommended" ? "recommended" : "votes";
  const sortOrder: SQL =
    sort === "newest"
      ? desc(products.publishedAt)
      : sort === "recommended"
        ? desc(products.score)
        : desc(products.upvoteCount);
  // Avec une requête : pertinence d'abord, tri demandé en départage.
  // Sans requête : tri demandé seul (comportement inchangé).
  const orderBy: SQL[] = tsQuery
    ? [sql`ts_rank("products"."search_vector", ${tsQuery}) DESC`, sortOrder]
    : [sortOrder];
  const rows = await fetchDiscoverRows({ conditions, orderBy, limit: DISCOVER_PAGE_SIZE, offset });
  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...conditions));
  const daily = await fetchDailyVotes(rows.map((r) => r.id));
  return { items: mapDiscoverItems(rows, daily), total };
}

/** Select cartes + maker (jointure), partagé web/mobile. */
export async function fetchDiscoverRows(input: {
  conditions: SQL[];
  orderBy: SQL[];
  limit: number;
  offset?: number;
}): Promise<DiscoverRow[]> {
  const base = db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      category: products.category,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
      upvoteCount: products.upvoteCount,
      iconUrl: products.iconUrl,
      pricingModel: products.pricingModel,
      productType: products.productType,
      ratingsSum: products.ratingsSum,
      ratingsCount: products.ratingsCount,
      commentsCount: products.commentsCount,
      curated: products.curated,
      platforms: products.platforms,
      audience: products.audience,
      lifecycle: products.lifecycle,
      publishedAt: products.publishedAt,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(...input.conditions))
    .orderBy(...input.orderBy, desc(products.publishedAt), desc(products.id))
    .limit(input.limit)
    .$dynamic();
  return input.offset ? base.offset(input.offset) : base;
}

/**
 * Flux public mobile (4D) : nouveautés filtrables en keyset
 * (`publishedAt` + id, stable), recherche en pertinence + pages.
 * - sans `q` : `{ items, nextCursor }` (`null` = fin) ;
 * - avec `q` : `{ items, nextCursor: null, page, total }` (le rang n'est
 *   pas un ordre keyset — pages offset assumées, documentées au contrat).
 */
export async function getPublicProductsFeed(
  input: DiscoverQuery & { limit?: number; cursor?: { at: Date; id: string } | null },
): Promise<{
  items: DiscoverItem[];
  nextCursor: { at: string; id: string } | null;
  page?: number;
  total?: number;
}> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const conditions = buildDiscoverConditions(input);
  const q = (input.q ?? "").trim();
  if (q === "") {
    if (input.cursor) {
      conditions.push(
        sql`(${products.publishedAt}, ${products.id}) < (${input.cursor.at.toISOString()}::timestamptz, ${input.cursor.id}::uuid)`,
      );
    }
    const rows = await fetchDiscoverRows({
      conditions,
      orderBy: [desc(products.publishedAt), desc(products.id)],
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const daily = await fetchDailyVotes(page.map((r) => r.id));
    return {
      items: mapDiscoverItems(page, daily),
      nextCursor:
        rows.length > limit && last?.publishedAt
          ? { at: last.publishedAt.toISOString(), id: last.id }
          : null,
    };
  }
  const page = Math.max(1, input.page ?? 1);
  const tsQuery = discoverTsQuery(q);
  const rows = await fetchDiscoverRows({
    conditions,
    orderBy: [sql`ts_rank("products"."search_vector", ${tsQuery}) DESC`],
    limit,
    offset: (page - 1) * limit,
  });
  const daily = await fetchDailyVotes(rows.map((r) => r.id));
  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...conditions));
  return { items: mapDiscoverItems(rows, daily), nextCursor: null, page, total };
}

type DiscoverRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  upvoteCount: number;
  iconUrl: string | null;
  pricingModel: string;
  productType: string;
  platforms: string[];
  audience: string;
  lifecycle: string;
  publishedAt: Date | null;
  ratingsSum: number;
  ratingsCount: number;
  commentsCount: number;
  curated: boolean;
};

/** Vélocité par fiche (1 requête groupée — même pattern que le leaderboard).
 * Dates en ISO-string dans les templates sql (objet Date brut = erreur driver). */
export async function fetchDailyVotes(ids: string[]): Promise<Map<string, number>> {
  const daily = new Map<string, number>();
  if (ids.length === 0) return daily;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const counts = await db
    .select({ productId: votes.productId, n: sql<number>`count(*)::int` })
    .from(votes)
    .where(
      and(
        sql`${votes.productId} IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
        sql`${votes.createdAt} >= ${dayStart.toISOString()}::timestamptz`,
      ),
    )
    .groupBy(votes.productId);
  for (const c of counts) daily.set(c.productId, c.n);
  return daily;
}

const pricingLabel = new Map(PRICING_MODELS.map((p) => [p.id, p.label]));

export function mapDiscoverItems(rows: DiscoverRow[], daily: Map<string, number>): DiscoverItem[] {
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    categoryId: r.category,
    makerUsername: r.makerUsername,
    makerDisplayName: r.makerDisplayName,
    makerAvatarUrl: r.makerAvatarUrl,
    votes: r.upvoteCount,
    iconUrl: r.iconUrl,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    pricingId: r.pricingModel,
    pricingLabel: pricingLabel.get(r.pricingModel) ?? r.pricingModel,
    productTypeLabel: getProductTypeById(r.productType).label,
    platforms: r.platforms,
    audienceId: r.audience,
    lifecycle: r.lifecycle,
    dailyVotes: daily.get(r.id) ?? 0,
    publishedAt: (r.publishedAt ?? new Date()).toISOString(),
    ratingAvg: ratingsAvgOf(r.ratingsSum, r.ratingsCount),
    ratingsCount: r.ratingsCount,
    commentsCount: r.commentsCount,
    curated: r.curated,
  }));
}
