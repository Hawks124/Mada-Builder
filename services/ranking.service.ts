import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { featuredProducts, products, users, votes } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { PRICING_MODELS } from "@/config/pricing";
import { getProductTypeById } from "@/config/product-types";
import { PLATFORMS } from "@/config/platforms";
import { getRatingById } from "@/config/ratings";
import { appGradientFor, appInitialsFor, ratingsAvgOf } from "@/services/products.service";
import type { FeaturedProductData } from "@/services/home.service";

/**
 * Classement + produit du jour (§11) + jobs.
 *
 * Score (décroissance temporelle) : `w / (h+2)^1.5` où w = votes pondérés
 * (SUM weight — shadow-weighting inclus dans le rang), h = heures depuis
 * publication. Dénormalisé sur `products.score` (requête la plus chaude),
 * recalculé par sweep 15 min (30 j glissants) + immédiatement au vote
 * (`recountProductScore`, pas d'attente cron).
 * Onglets : today (publiés jour UTC, votes pondérés, départage
 * `published_at` asc), week/month (fenêtre, `score`), all (`upvote_count`).
 * Frontières jour en UTC (minuit UTC = 3 h à Tana — documenté, V1).
 */

export type RankingWindow = "today" | "week" | "month" | "all";

const PLATFORM_LABEL = new Map(PLATFORMS.map((p) => [p.id, p.label]));
const PRICING_LABEL = new Map(PRICING_MODELS.map((p) => [p.id, p.label]));

function dateLabelFr(d: Date): string {
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Slot DB → carte hero (même mapping home + /leaderboard, source unique).
 * Chiffres honnêtes : commentaires/avis à 0 (V1.5), pas de pricingDetail
 * inventé, âges via config/ratings.
 */
export function toFeaturedCard(
  slot: FeaturedSlot,
  opts?: { initialVoted?: boolean; now?: Date },
): FeaturedProductData {
  const rating = getRatingById(slot.audienceId);
  return {
    id: slot.slug,
    name: slot.name,
    tagline: slot.tagline,
    categoryId: slot.categoryId,
    maker: slot.makerDisplayName,
    makerUsername: slot.makerUsername,
    makerAvatar: slot.makerAvatarUrl ?? "",
    productUuid: slot.productId,
    initialVoted: opts?.initialVoted ?? false,
    votes: slot.votes,
    comments: 0,
    initials: slot.initials,
    dateLabel: `Édition du ${dateLabelFr(opts?.now ?? new Date())}`,
    platforms: slot.platforms.map((p) => PLATFORM_LABEL.get(p) ?? p),
    pricingLabel: slot.pricingLabel,
    pricingDetail: "",
    ageRating: rating.badge,
    ageLabel: rating.label,
    rating: "",
    reviewsCount: 0,
  };
}

function startOfTodayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mêmes maths qu'en SQL ci-dessous (sweep) — une seule formule, deux moteurs. */
export function scoreFor(weighted: number, publishedAt: Date, now: Date = new Date()): number {
  const hours = Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
  return weighted / Math.pow(hours + 2, 1.5);
}

/**
 * Rescore immédiat d'une fiche (après vote) : recompte exact + formule.
 * Fiche non publiée → compteur seul (le score ne sert qu'au classement).
 */
export async function recountProductScore(productId: string): Promise<void> {
  const [row] = await db
    .select({ status: products.status, publishedAt: products.publishedAt })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) return;
  // Compte + pondéré en UNE requête (même regroupement que le toggle).
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      weighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int`,
    })
    .from(votes)
    .where(eq(votes.productId, productId));
  const total = counts?.total ?? 0;
  const weighted = counts?.weighted ?? 0;
  const patch: { upvoteCount: number; updatedAt: Date; score?: number } = {
    upvoteCount: total,
    updatedAt: new Date(),
  };
  if (row.status === "published" && row.publishedAt) {
    patch.score = scoreFor(weighted, row.publishedAt);
  }
  await db.update(products).set(patch).where(eq(products.id, productId));
}

/**
 * Sweep 15 min (pg_cron en prod, `scripts/run-jobs.ts` en dev) : promotion
 * des poids d'abord, puis recompte exact + rescore de TOUTES les fiches
 * publiées (30 j glissants pour le score ; compteurs auto-réparants
 * partout). 3 requêtes, jamais de N+1.
 *
 * Promotion (anti-faille shadow-weighting) : un vote posé par un compte
 * de < 24 h naît à `weight = 0` — SANS cette requête il resterait à 0
 * pour toujours, même après les 24 h. Le sweep promeut à 1 les votes des
 * comptes devenus majeurs (jamais bannis/supprimés), AVANT le rescore
 * du même passage : le dialogue « il pèsera au classement quand ton
 * compte aura 24 h » est donc vrai. Idempotent, même source d'âge que
 * `checkVoter` (`users.created_at`).
 */
export async function recomputeScores(
  now: Date = new Date(),
): Promise<{ updated: number; promoted: number }> {
  const r0 = await db.execute(sql`
    UPDATE ${votes} v SET weight = 1
    WHERE v.weight = 0
      AND EXISTS (
        SELECT 1 FROM ${users} u
        WHERE u.id = v.user_id
          AND u.created_at < ${now.toISOString()}::timestamptz - INTERVAL '24 hours'
          AND u.deleted_at IS NULL
          AND u.banned_at IS NULL
      )
  `);
  const r1 = await db.execute(sql`
    UPDATE ${products} p SET
      upvote_count = COALESCE(sub.total, 0),
      score = COALESCE(sub.weighted, 0) / POWER(GREATEST(EXTRACT(EPOCH FROM (${now.toISOString()}::timestamptz - p.published_at)) / 3600, 0) + 2, 1.5),
      updated_at = ${now.toISOString()}::timestamptz
    FROM (
      SELECT product_id, COUNT(*)::int AS total, COALESCE(SUM(weight), 0)::int AS weighted
      FROM ${votes} GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND p.published_at > ${now.toISOString()}::timestamptz - INTERVAL '30 days'
  `);
  const r2 = await db.execute(sql`
    UPDATE ${products} p SET upvote_count = 0, score = 0, updated_at = ${now.toISOString()}::timestamptz
    WHERE p.status = 'published' AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM ${votes} v WHERE v.product_id = p.id)
      AND (p.upvote_count <> 0 OR p.score <> 0)
  `);
  const updated =
    Number((r1 as unknown as { rowCount?: number }).rowCount ?? 0) +
    Number((r2 as unknown as { rowCount?: number }).rowCount ?? 0);
  const promoted = Number((r0 as unknown as { rowCount?: number }).rowCount ?? 0);
  return { updated, promoted };
}

export type LeaderboardItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryId: string;
  productTypeId: string;
  productTypeLabel: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  votes: number;
  weightedVotes: number;
  dailyVotes: number;
  iconUrl: string | null;
  iconGradient: string;
  initials: string;
  pricingId: string;
  pricingLabel: string;
  publishedAt: string;
};

export type LeaderboardResult = {
  items: LeaderboardItem[];
  total: number;
  /** Votes bruts cumulés du périmètre (headers "X votes au total"). */
  totalVotes: number;
  /** Votes pondérés cumulés (rangs taxonomiques "par poids"). */
  totalWeighted: number;
};

const LEADERBOARD_PAGE_SIZE = 15;

/**
 * Classement paginé (offset — pages numérotées côté UI, volume V1).
 * `cat` = appartenance (ANY categories, pas seulement primaire).
 * `order: "weighted"` = rang taxonomique (all-time, pondérés, hors fenêtre).
 */
export async function getLeaderboard(input: {
  window: RankingWindow;
  category?: string | null;
  productType?: string | null;
  page?: number;
  order?: "window" | "weighted";
}): Promise<LeaderboardResult> {
  const now = new Date();
  const page = Math.max(1, input.page ?? 1);
  const offset = (page - 1) * LEADERBOARD_PAGE_SIZE;
  // Curation exclue du JEU (classement voté) — catalogue oui (discover,
  // recherche, nouveautés, sitemap). Jamais de produit veille au rang.
  const conditions = [
    eq(products.status, "published"),
    isNull(products.deletedAt),
    eq(products.curated, false),
  ];
  if (input.category) {
    conditions.push(sql`${input.category} = ANY(${products.categories})`);
  }
  if (input.productType) conditions.push(eq(products.productType, input.productType as never));

  let orderBy: SQL;
  if (input.window === "today" || input.order === "weighted") {
    if (input.window === "today") {
      conditions.push(gte(products.publishedAt, startOfTodayUTC(now)));
    }
    // Votes pondérés : jointure + groupe (pas de colonne dédiée —
    // le dénormalisé upvote_count est brut, le rang est pondéré).
    // Taxonomique : plus récent d'abord à égalité (page vivante).
    const tiebreak = input.order === "weighted" ? desc(products.publishedAt) : products.publishedAt;
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        tagline: products.tagline,
        category: products.category,
        productType: products.productType,
        makerUsername: users.username,
        makerDisplayName: users.displayName,
        makerAvatarUrl: users.avatarUrl,
        upvoteCount: products.upvoteCount,
        weighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int`,
        daily: sql<number>`count(${votes.id}) FILTER (WHERE ${votes.createdAt} >= ${startOfTodayUTC(now).toISOString()}::timestamptz)::int`,
        iconUrl: products.iconUrl,
        pricingModel: products.pricingModel,
        publishedAt: products.publishedAt,
      })
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .leftJoin(votes, eq(votes.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.id, users.id)
      .orderBy(sql`coalesce(sum(${votes.weight}), 0) DESC`, tiebreak)
      .limit(LEADERBOARD_PAGE_SIZE)
      .offset(offset);
    const totals = await countLeaderboard(conditions);
    // Le groupe fournit déjà pondérés + quotidiens exacts (pas de 2e requête).
    return { items: rows.map((r) => toLeaderboardItem(r, r.daily)), ...totals };
  }

  if (input.window === "week" || input.window === "month") {
    const days = input.window === "week" ? 7 : 30;
    conditions.push(gte(products.publishedAt, new Date(now.getTime() - days * 86_400_000)));
    orderBy = desc(products.score);
  } else {
    orderBy = desc(products.upvoteCount);
  }
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      category: products.category,
      productType: products.productType,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
      upvoteCount: products.upvoteCount,
      iconUrl: products.iconUrl,
      pricingModel: products.pricingModel,
      publishedAt: products.publishedAt,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy, desc(products.publishedAt))
    .limit(LEADERBOARD_PAGE_SIZE)
    .offset(offset);
  const totals = await countLeaderboard(conditions);
  const stats = await voteStatsFor(
    rows.map((r) => r.id),
    now,
  );
  return {
    items: rows.map((r) => {
      const s = stats.get(r.id) ?? { daily: 0, weighted: r.upvoteCount };
      return toLeaderboardItem({ ...r, weighted: s.weighted, daily: s.daily }, s.daily);
    }),
    ...totals,
  };
}

async function countLeaderboard(
  conditions: SQL[],
): Promise<{ total: number; totalVotes: number; totalWeighted: number }> {
  const [countRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalVotes: sql<number>`coalesce(sum(${products.upvoteCount}), 0)::int`,
    })
    .from(products)
    .where(and(...conditions));
  const [weightRow] = await db
    .select({ totalWeighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int` })
    .from(votes)
    .where(
      sql`${votes.productId} IN (SELECT ${products.id} FROM ${products} WHERE ${and(...conditions)})`,
    );
  return {
    total: countRow.total,
    totalVotes: countRow.totalVotes,
    totalWeighted: weightRow?.totalWeighted ?? 0,
  };
}

/**
 * Stats votes par produit (1 requête) : quotidien calendaire (UTC) pour
 * l'affichage + pondérés pour le rang hors-today.
 */
async function voteStatsFor(
  productIds: string[],
  now: Date,
): Promise<Map<string, { daily: number; weighted: number }>> {
  const map = new Map<string, { daily: number; weighted: number }>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({
      productId: votes.productId,
      daily: sql<number>`count(*) FILTER (WHERE ${votes.createdAt} >= ${startOfTodayUTC(now).toISOString()}::timestamptz)::int`,
      weighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int`,
    })
    .from(votes)
    .where(
      sql`${votes.productId} IN (${sql.join(
        productIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    )
    .groupBy(votes.productId);
  for (const r of rows) map.set(r.productId, { daily: r.daily, weighted: r.weighted });
  return map;
}

function toLeaderboardItem(
  r: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    category: string;
    productType: string;
    makerUsername: string;
    makerDisplayName: string;
    makerAvatarUrl: string | null;
    upvoteCount: number;
    weighted: number;
    daily: number;
    iconUrl: string | null;
    pricingModel: string;
    publishedAt: Date | null;
  },
  dailyVotes: number,
): LeaderboardItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    categoryId: r.category,
    productTypeId: r.productType,
    productTypeLabel: getProductTypeById(r.productType).label,
    makerUsername: r.makerUsername,
    makerDisplayName: r.makerDisplayName,
    makerAvatarUrl: r.makerAvatarUrl,
    votes: r.upvoteCount,
    weightedVotes: r.weighted,
    dailyVotes,
    iconUrl: r.iconUrl,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    pricingId: r.pricingModel,
    pricingLabel: PRICING_LABEL.get(r.pricingModel) ?? r.pricingModel,
    publishedAt: (r.publishedAt ?? new Date()).toISOString(),
  };
}

export type NewestItem = {
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
  platforms: string[];
  audienceId: string;
  publishedAt: string;
  ratingAvg: number;
  ratingsCount: number;
  curated: boolean;
};

/**
 * Rangs "tout le temps" (top 15 pondéré) pour un lot de produits (Lot 3) :
 * 1 requête. Absent = hors top (undefined, jamais de faux rang).
 */
export async function getProductRanks(productIds: string[]): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const board = await getLeaderboard({ window: "all", order: "weighted", page: 1 });
  const wanted = new Set(productIds);
  const ranks: Record<string, number> = {};
  board.items.forEach((item, i) => {
    if (wanted.has(item.id)) ranks[item.id] = i + 1;
  });
  return ranks;
}

/** Récence pure (Phase 3) : publiés, `publishedAt` desc. */
export async function getNewest(limit = 6): Promise<NewestItem[]> {
  const rows = await db
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
      ratingsSum: products.ratingsSum,
      ratingsCount: products.ratingsCount,
      curated: products.curated,
      platforms: products.platforms,
      audience: products.audience,
      publishedAt: products.publishedAt,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .orderBy(desc(products.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 20));
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
    pricingLabel: PRICING_LABEL.get(r.pricingModel) ?? r.pricingModel,
    platforms: r.platforms,
    audienceId: r.audience,
    publishedAt: (r.publishedAt ?? new Date()).toISOString(),
    ratingAvg: ratingsAvgOf(r.ratingsSum, r.ratingsCount),
    ratingsCount: r.ratingsCount,
    curated: r.curated,
  }));
}

export type FeaturedSlot = {
  productId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string;
  productTypeId: string;
  productTypeLabel: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  votes: number;
  iconUrl: string | null;
  iconGradient: string;
  initials: string;
  pricingId: string;
  pricingLabel: string;
  platforms: string[];
  audienceId: string;
  galleryOrientation: "portrait" | "landscape";
  featuredOn: string;
  pinned: boolean;
  /** Palier ayant désigné la fiche : jamais vide, jamais figé. */
  tier: "top" | "rotation" | "latest" | "pinned";
};

function toFeaturedSlot(
  r: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    category: string;
    productType: string;
    makerUsername: string;
    makerDisplayName: string;
    makerAvatarUrl: string | null;
    upvoteCount: number;
    iconUrl: string | null;
    pricingModel: string;
    platforms: string[];
    audience: string;
    galleryOrientation: string;
    featuredOn: string;
    pinned: boolean;
  },
  tier: FeaturedSlot["tier"],
): FeaturedSlot {
  return {
    productId: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    categoryId: r.category,
    productTypeId: r.productType,
    productTypeLabel: getProductTypeById(r.productType).label,
    makerUsername: r.makerUsername,
    makerDisplayName: r.makerDisplayName,
    makerAvatarUrl: r.makerAvatarUrl,
    votes: r.upvoteCount,
    iconUrl: r.iconUrl,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    pricingId: r.pricingModel,
    pricingLabel: PRICING_LABEL.get(r.pricingModel) ?? r.pricingModel,
    platforms: r.platforms,
    audienceId: r.audience,
    galleryOrientation: r.galleryOrientation === "portrait" ? "portrait" : "landscape",
    featuredOn: r.featuredOn,
    pinned: r.pinned,
    tier,
  };
}

const FEATURED_SELECT = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  tagline: products.tagline,
  description: products.description,
  category: products.category,
  productType: products.productType,
  makerUsername: users.username,
  makerDisplayName: users.displayName,
  makerAvatarUrl: users.avatarUrl,
  upvoteCount: products.upvoteCount,
  iconUrl: products.iconUrl,
  pricingModel: products.pricingModel,
  platforms: products.platforms,
  audience: products.audience,
  galleryOrientation: products.galleryOrientation,
};

/**
 * Produit du jour — paresseux mais explicite : la ligne du jour existe
 * (cron quotidien) sinon elle est calculée ici (panne cron couverte).
 * Paliers : top (#1 d'hier non-featuré 30 j, catalogue ≥ 5) → rotation
 * (moins-récemment-featuré, re-feature ≥ 7 j) → dernier publié →
 * `null` (état "soyez le premier"). `pinned` du jour respecté.
 */
export async function getFeatured(now: Date = new Date()): Promise<FeaturedSlot | null> {
  const today = utcDateString(now);
  const [existing] = await db
    .select({
      ...FEATURED_SELECT,
      featuredOn: featuredProducts.featuredOn,
      pinned: featuredProducts.pinned,
    })
    .from(featuredProducts)
    .innerJoin(products, eq(products.id, featuredProducts.productId))
    .innerJoin(users, eq(products.makerId, users.id))
    .where(
      and(
        eq(featuredProducts.featuredOn, today),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return toFeaturedSlot(existing, existing.pinned ? "pinned" : "top");
  }
  const computed = await computeFeatured(now);
  if (!computed) return null;
  const [inserted] = await db
    .insert(featuredProducts)
    .values({ productId: computed.productId, featuredOn: today, pinned: false })
    .onConflictDoNothing({ target: featuredProducts.featuredOn })
    .returning({ featuredOn: featuredProducts.featuredOn, pinned: featuredProducts.pinned });
  return toFeaturedSlot(
    {
      ...computed.row,
      featuredOn: inserted?.featuredOn ?? today,
      pinned: inserted?.pinned ?? false,
    },
    computed.tier,
  );
}

type ComputedFeatured = {
  row: Omit<Parameters<typeof toFeaturedSlot>[0], "featuredOn" | "pinned">;
  tier: "top" | "rotation" | "latest";
  productId: string;
};

async function publishedCount(): Promise<number> {
  const [{ value }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
  return value;
}

async function computeFeatured(now: Date): Promise<ComputedFeatured | null> {
  const total = await publishedCount();
  if (total === 0) return null;
  if (total === 1) {
    const [only] = await db
      .select(FEATURED_SELECT)
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .where(
        and(
          eq(products.status, "published"),
          isNull(products.deletedAt),
          eq(products.curated, false),
        ),
      )
      .orderBy(desc(products.publishedAt))
      .limit(1);
    if (!only) return null;
    return { row: only, tier: "latest", productId: only.id };
  }
  if (total < 5) {
    // Rotation : jamais-featuré d'abord, sinon moins-récemment-featuré
    // (re-feature ≥ 7 j — le slot tourne même à faible volume).
    const weekAgo = utcDateString(new Date(now.getTime() - 7 * 86_400_000));
    const [row] = await db
      .select({
        ...FEATURED_SELECT,
        lastFeatured: sql<string | null>`max(${featuredProducts.featuredOn})`,
      })
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .leftJoin(featuredProducts, eq(featuredProducts.productId, products.id))
      .where(
        and(
          eq(products.status, "published"),
          isNull(products.deletedAt),
          eq(products.curated, false),
          or(
            sql`${featuredProducts.featuredOn} IS NULL`,
            sql`${featuredProducts.featuredOn} < ${weekAgo}`,
          )!,
        ),
      )
      .groupBy(products.id, users.id)
      .orderBy(sql`max(${featuredProducts.featuredOn}) ASC NULLS FIRST`, desc(products.publishedAt))
      .limit(1);
    if (!row) return null;
    const { lastFeatured, ...rest } = row;
    void lastFeatured;
    return { row: rest, tier: "rotation", productId: rest.id };
  }
  // Normal : #1 d'hier (votes pondérés) non-featuré depuis 30 j.
  const todayStart = startOfTodayUTC(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const monthAgo = utcDateString(new Date(now.getTime() - 30 * 86_400_000));
  const [row] = await db
    .select({ ...FEATURED_SELECT, weighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int` })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .leftJoin(votes, eq(votes.productId, products.id))
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
        gte(products.publishedAt, yesterdayStart),
        sql`${products.publishedAt} < ${todayStart.toISOString()}::timestamptz`,
        sql`NOT EXISTS (SELECT 1 FROM ${featuredProducts} f WHERE f.product_id = ${products.id} AND f.featured_on >= ${monthAgo})`,
      ),
    )
    .groupBy(products.id, users.id)
    .orderBy(sql`coalesce(sum(${votes.weight}), 0) DESC`, products.publishedAt)
    .limit(1);
  if (!row) {
    // Hier sans publication (week-end, vacances) : repli rotation.
    return computeFeaturedRotationFallback(now);
  }
  const { weighted, ...rest } = row;
  void weighted;
  return { row: rest, tier: "top", productId: rest.id };
}

async function computeFeaturedRotationFallback(now: Date): Promise<ComputedFeatured | null> {
  const weekAgo = utcDateString(new Date(now.getTime() - 7 * 86_400_000));
  const [row] = await db
    .select({
      ...FEATURED_SELECT,
      lastFeatured: sql<string | null>`max(${featuredProducts.featuredOn})`,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .leftJoin(featuredProducts, eq(featuredProducts.productId, products.id))
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
        or(
          sql`${featuredProducts.featuredOn} IS NULL`,
          sql`${featuredProducts.featuredOn} < ${weekAgo}`,
        )!,
      ),
    )
    .groupBy(products.id, users.id)
    .orderBy(sql`max(${featuredProducts.featuredOn}) ASC NULLS FIRST`, desc(products.publishedAt))
    .limit(1);
  if (!row) return null;
  const { lastFeatured, ...rest } = row;
  void lastFeatured;
  return { row: rest, tier: "rotation", productId: rest.id };
}

/** Fiche : produits liés (même catégorie primaire, hors soi, par score). */
export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 3,
): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    iconUrl: string | null;
    iconGradient: string;
    initials: string;
    votes: number;
    makerUsername: string;
    makerDisplayName: string;
    makerAvatarUrl: string | null;
  }>
> {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      iconUrl: products.iconUrl,
      upvoteCount: products.upvoteCount,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.category, categoryId),
        sql`${products.id} <> ${productId}::uuid`,
      ),
    )
    .orderBy(desc(products.score), desc(products.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 6));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    iconUrl: r.iconUrl,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    votes: r.upvoteCount,
    makerUsername: r.makerUsername,
    makerDisplayName: r.makerDisplayName,
    makerAvatarUrl: r.makerAvatarUrl,
  }));
}

/** Job quotidien (pg_cron) : calcule aujourd'hui, explicite + loggable. */
export async function rotateFeaturedDaily(
  now: Date = new Date(),
): Promise<{ productId: string | null; tier: FeaturedSlot["tier"] | "empty" }> {
  const slot = await getFeatured(now);
  if (!slot) return { productId: null, tier: "empty" };
  return { productId: slot.productId, tier: slot.tier };
}

/** Résolution slug → id (override admin, jamais d'uuid tapé à la main). */
export async function findPublishedIdBySlug(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.slug, slug.toLowerCase()),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Override admin : épingle une fiche publiée aujourd'hui (respecté par le
 * job et le lazy). `null` = lever l'épingle (le palier reprend la main).
 */ export async function setFeaturedOverride(input: {
  isStaff: boolean;
  productId: string | null;
  now?: Date;
}): Promise<{ productId: string | null; previousProductId: string | null }> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const today = utcDateString(input.now ?? new Date());
  const [current] = await db
    .select({ productId: featuredProducts.productId })
    .from(featuredProducts)
    .where(eq(featuredProducts.featuredOn, today))
    .limit(1);
  if (input.productId === null) {
    if (current) {
      await db.delete(featuredProducts).where(eq(featuredProducts.featuredOn, today));
    }
    return { productId: null, previousProductId: current?.productId ?? null };
  }
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
      ),
    )
    .limit(1);
  if (!row) {
    // Inconnu, dépublié... ou veille (jamais épinglable) : même 404,
    // pas d'oracle.
    throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  }
  await db
    .insert(featuredProducts)
    .values({ productId: row.id, featuredOn: today, pinned: true })
    .onConflictDoUpdate({
      target: featuredProducts.featuredOn,
      set: { productId: row.id, pinned: true },
    });
  return { productId: row.id, previousProductId: current?.productId ?? null };
}
