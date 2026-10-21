import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { comments, featuredProducts, products, reviews, users, votes } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { PRICING_MODELS } from "@/config/pricing";
import { getProductTypeById } from "@/config/product-types";
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
 * Chiffres réels : commentaires (compteur) + avis (ratingsCount).
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
    comments: slot.commentsCount,
    initials: slot.initials,
    iconUrl: slot.iconUrl,
    dateLabel: `Édition du ${dateLabelFr(opts?.now ?? new Date())}`,
    platforms: slot.platforms,
    pricingLabel: slot.pricingLabel,
    pricingDetail: "",
    ageRating: rating.badge,
    ageLabel: rating.label,
    rating: "",
    reviewsCount: slot.ratingsCount,
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
  /** Votes reçus DANS la fenêtre courante (aujourd'hui / semaine / mois).
   *  C'est ce nombre qui classe la carte, et c'est celui qu'elle affiche. */
  windowVotes?: number;
  iconUrl: string | null;
  iconGradient: string;
  initials: string;
  pricingId: string;
  pricingLabel: string;
  publishedAt: string;
  /** Build approuvé < 14 j (D6) : libellé version — badge « Mis à jour ». */
  updatedLabel?: string | null;
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

  // ── RANG TAXONOMIQUE (poids all-time) ──────────────────────────
  // La fenêtre NE change rien ici : c'est le second classement de la
  // page, pas une surcharge du podium.
  if (input.order === "weighted") {
    // Votes pondérés : jointure + groupe (pas de colonne dédiée —
    // le dénormalisé upvote_count est brut, le rang est pondéré).
    // Taxonomique : plus récent d'abord à égalité (page vivante).
    const tiebreak = desc(products.publishedAt);
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

  // ── FENÊTRES TEMPORELLES ───────────────────────────────────────
  // Le rang EST le nombre de votes cumulés dans la fenêtre, et c'est ce
  // nombre que la carte affiche : avant, la fenêtre « semaine » ordonnait
  // par `score` (décroissance temporelle) mais affichait le total de
  // votes → les numéros ne correspondaient pas à l'ordre affiché.
  const windowStart: Date | null =
    input.window === "today"
      ? startOfTodayUTC(now)
      : input.window === "week"
        ? new Date(now.getTime() - 7 * 86_400_000)
        : input.window === "month"
          ? new Date(now.getTime() - 30 * 86_400_000)
          : null;

  if (windowStart) {
    conditions.push(gte(products.publishedAt, windowStart));
    // Même expression au SELECT et à l'ORDER BY : le nombre affiché EST
    // celui qui classe.
    const votesFenetre = sql<number>`count(${votes.id}) FILTER (WHERE ${votes.createdAt} >= ${windowStart.toISOString()}::timestamptz)::int`;
    // Départage : le plus ancien d'abord aujourd'hui (PRD §11), le plus
    // récent d'abord sur les fenêtres longues (page vivante).
    const tiebreak = input.window === "today" ? products.publishedAt : desc(products.publishedAt);
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
        windowVotes: votesFenetre,
        iconUrl: products.iconUrl,
        pricingModel: products.pricingModel,
        publishedAt: products.publishedAt,
      })
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .leftJoin(votes, eq(votes.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.id, users.id)
      .orderBy(sql`${votesFenetre} DESC`, tiebreak)
      .limit(LEADERBOARD_PAGE_SIZE)
      .offset(offset);
    const totals = await countLeaderboard(conditions);
    // Le total de votes de la fenêtre (pas le cumul des produits) : c'est
    // ce qui dit si une fenêtre « vit ».
    const [windowTotals] = await db
      .select({
        windowTotal: sql<number>`coalesce(count(${votes.id}) FILTER (WHERE ${votes.createdAt} >= ${windowStart.toISOString()}::timestamptz), 0)::int`,
      })
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .leftJoin(votes, eq(votes.productId, products.id))
      .where(and(...conditions));
    return {
      items: rows.map((r) => toLeaderboardItem(r, r.daily, r.windowVotes)),
      ...totals,
      totalVotes: windowTotals?.windowTotal ?? 0,
    };
  }

  // ── FENÊTRE « TOUT LE TEMPS » ──────────────────────────────────
  // Aucun filtre de date : le rang est le total de votes (le nombre
  // affiché par le bouton de vote), le plus récent d'abord à égalité.
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
      commentsCount: products.commentsCount,
      ratingsCount: products.ratingsCount,
      iconUrl: products.iconUrl,
      pricingModel: products.pricingModel,
      publishedAt: products.publishedAt,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(products.upvoteCount), desc(products.publishedAt))
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
  windowVotes?: number,
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
    ...(windowVotes === undefined ? {} : { windowVotes }),
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
  commentsCount: number;
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
      commentsCount: products.commentsCount,
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
    commentsCount: r.commentsCount,
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
  commentsCount: number;
  ratingsCount: number;
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
    commentsCount: number;
    ratingsCount: number;
    curated: boolean;
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
    commentsCount: r.commentsCount,
    ratingsCount: r.ratingsCount,
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
  commentsCount: products.commentsCount,
  ratingsCount: products.ratingsCount,
  curated: products.curated,
  iconUrl: products.iconUrl,
  pricingModel: products.pricingModel,
  platforms: products.platforms,
  audience: products.audience,
  galleryOrientation: products.galleryOrientation,
  // Signal + attente du slot : le score se calcule sur ces colonnes.
  ratingsSum: products.ratingsSum,
  publishedAt: products.publishedAt,
  updatedAt: products.updatedAt,
};

/**
 * Produit du jour — paresseux mais explicite : la ligne du jour existe
 * (cron quotidien) sinon elle est calculée ici (panne cron couverte).
 * Une seule règle (priorité, pas file d'attente) : l'attente bornée
 * (7 j) + le signal d'activité (votes pondérés, commentaires, avis, note
 * moyenne) → jamais vide tant qu'un produit éligible existe, jamais
 * l'ordre d'arrivée. Voir `computeFeatured`.
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
    // Veille marquée APRÈS featuring (ou ligne héritée) : jamais de
    // curated en vitrine — on ignore et on recalcule (souvent null).
    if (!existing.curated) {
      return toFeaturedSlot(existing, existing.pinned ? "pinned" : "top");
    }
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

/**
 * Slot d'un produit désigné par son id — aperçu admin avant épinglage.
 *
 * Miroir de `getFeatured` sur un produit précis : même projection, même
 * conversion, donc la carte rendue est exactement celle du hero. Mêmes
 * filtres que `setFeaturedOverride` (publié, hors veille, non supprimé) pour
 * que l'aperçu ne montre jamais un produit que l'épinglage refuserait.
 */
export async function getFeaturedSlotByProductId(productId: string): Promise<FeaturedSlot | null> {
  const [row] = await db
    .select({
      ...FEATURED_SELECT,
      featuredOn: sql<string>`to_char(coalesce(${products.publishedAt}, ${products.createdAt}), 'YYYY-MM-DD')`,
      pinned: sql<boolean>`true`,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(
      and(
        eq(products.id, productId),
        eq(products.status, "published"),
        eq(products.curated, false),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  return row ? toFeaturedSlot(row, "top") : null;
}

export type FeaturedHistoryRow = {
  featuredOn: string;
  pinned: boolean;
  slug: string;
  name: string;
};

/**
 * Historique des produits du jour, du plus récent au plus ancien.
 *
 * `getFeatured` insère la ligne du jour même quand le cron n'a pas tourné :
 * la table est donc un journal quotidien complet, pas seulement la liste des
 * épinglages. `pinned` distingue ce que l'équipe a choisi de ce que le palier
 * automatique a pris — l'info utile quand on est seul à administrer.
 */
export async function getFeaturedHistory(limit = 30): Promise<FeaturedHistoryRow[]> {
  return db
    .select({
      featuredOn: featuredProducts.featuredOn,
      pinned: featuredProducts.pinned,
      slug: products.slug,
      name: products.name,
    })
    .from(featuredProducts)
    .innerJoin(products, eq(products.id, featuredProducts.productId))
    .orderBy(desc(featuredProducts.featuredOn))
    .limit(limit);
}

type ComputedFeatured = {
  row: Omit<Parameters<typeof toFeaturedSlot>[0], "featuredOn" | "pinned">;
  tier: "top" | "rotation" | "latest";
  productId: string;
};

/**
 * Produit du jour — une PRIORITÉ, pas une file d'attente.
 *
 * LE PROBLÈME RÉGLÉ : l'ancien algo enfilait les produits dans une FILE
 * (jamais-featuré d'abord, puis moins-récemment-featuré, avec une fenêtre
 * de 7 jours d'exigibilité). Trois conséquences :
 *
 * 1. le slot pouvait être VIDE : les 3 produits éligibles étaient tous
 *    dans la fenêtre de 7 jours → plus aucun candidat → « soyez le
 *    premier » alors que le catalogue existait ;
 * 2. l'ordre dépendait de l'ARRIVÉE : à l'échelle, le slot devenait la
 *    FIFO des ajouts et le dernier publié attendait des semaines ;
 * 3. la fenêtre de 7 jours était un seuil figé, à recalculer à chaque
 *    changement de taille du catalogue.
 *
 * LA RÈGLE (une seule, deux bornes, aucun seuil sur la taille) :
 *
 *   attente(p)  = min(jours depuis la dernière mise en avant de p — ou
 *                  depuis sa publication si jamais mise en avant —, 7)
 *   signal(p)   = note moyenne + votes PONDÉRÉS 7 j
 *                  + 2 × commentaires 7 j + 3 × avis 7 j
 *   priorité(p) = min(signal(p), 7) + 2 × attente(p)
 *
 * - l'ATTENTE bornée : elle ne cumule plus au-delà d'une semaine → la
 *   file ne peut pas grossir (le problème d'échelle) ;
 * - le SIGNAL borné : un produit très vote ne peut pas monopoliser le
 *   slot (sans cette borne il gagnerait tous les jours) ;
 * - l'attente pèse DOUBLE : celui qui n'a pas eu sa part l'emporte sur
 *   celui qui est bruyant.
 *
 * Conséquences : le slot n'est JAMAIS vide tant qu'un produit éligible
 * existe (il y a toujours un premier) ; l'ordre ne dépend plus de
 * l'heure d'ajout ; personne n'est oublié (l'attente le fait remonter)
 * et personne ne hoggue (une mise en avant remet son attente à zéro) ;
 * publier ou republier ne remet PAS l'attente à zéro (c'est la dernière
 * mise en avant qui compte) → le slot n'est pas jouable.
 *
 * Les votes ne décident plus seuls : ils pèsent dans le signal, mais
 * l'ordre de service passe avant. Le produit du jour est une VITRINE,
 * pas un classement (le classement, c'est le leaderboard).
 */
const FEATURED_ATTENTE_PLAFOND_JOURS = 7;
const FEATURED_SIGNAL_PLAFOND = 7;
const FEATURED_SIGNAL_FENETRE_JOURS = 7;
const FEATURED_POIDS_ATTENTE = 2;
const FEATURED_POIDS_COMMENTAIRE = 2;
const FEATURED_POIDS_AVIS = 3;

/**
 * Candidat au produit du jour — les entrees du classement.
 *
 * Le calcul est PUR (aucune base) : il est testable seul, et c'est
 * justement ce qui manquait à l'ancien algo (ses règles étaient
 * melangees a la SQL, donc invérifiables).
 */
export type FeaturedCandidate = {
  id: string;
  /** Signal d'activite (note + votes pondérés + commentaires + avis). */
  signal: number;
  /** Jours d'attente (depuis la derniere mise en avant, ou la publication). */
  attente: number;
  /** Derniere modif de la fiche (proxy d'activite, gratuit). */
  updatedAt: Date | null;
  /** Date de publication (immuable : le tri par recence n'est pas jouable). */
  publishedAt: Date | null;
};

/** La priorite : les deux bornes (attente + signal) sont les seuls reglages. */
export function featuredPriorite(candidat: FeaturedCandidate): number {
  return (
    Math.min(candidat.signal, FEATURED_SIGNAL_PLAFOND) +
    FEATURED_POIDS_ATTENTE * Math.min(candidat.attente, FEATURED_ATTENTE_PLAFOND_JOURS)
  );
}

/**
 * Le classement du slot — deterministe, et PAS l'ordre d'arrivee.
 *
 * 1. la priorite (le service d'abord, le signal ensuite) ;
 * 2. a priorite egale, le plus recemment touche ;
 * 3. puis le plus recent ;
 * 4. puis l'id (stabilite totale : meme etat, meme resultat).
 */
export function classerFeatured<T extends FeaturedCandidate>(candidats: T[]): T[] {
  return [...candidats].sort((a, b) => {
    const pa = featuredPriorite(a);
    const pb = featuredPriorite(b);
    if (pb !== pa) return pb - pa;
    const aAct = a.updatedAt ? a.updatedAt.getTime() : 0;
    const bAct = b.updatedAt ? b.updatedAt.getTime() : 0;
    if (bAct !== aAct) return bAct - aAct;
    const aPub = a.publishedAt ? a.publishedAt.getTime() : 0;
    const bPub = b.publishedAt ? b.publishedAt.getTime() : 0;
    if (bPub !== aPub) return bPub - aPub;
    return a.id.localeCompare(b.id);
  });
}

/** Jours écoulés depuis une date ISO (date seule) — 0 si même jour. */
function joursEntre(iso: string | null, now: Date): number {
  if (!iso) return 0;
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

async function computeFeatured(now: Date): Promise<ComputedFeatured | null> {
  // 1. Les candidats (publiés, hors veille).
  const rows = await db
    .select(FEATURED_SELECT)
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
      ),
    );
  if (rows.length === 0) return null;
  const ids = rows.map((r) => r.id);

  // 2. Les mises en avant (équité : combien de fois, et quand la
  //    dernière) + l'activité de la semaine (le signal).
  const since = new Date(now.getTime() - FEATURED_SIGNAL_FENETRE_JOURS * 86_400_000);
  const [feats, votes7, comm7, avis7] = await Promise.all([
    db
      .select({
        productId: featuredProducts.productId,
        apparitions: sql<number>`count(*)::int`,
        dernier: sql<string | null>`max(${featuredProducts.featuredOn})`,
      })
      .from(featuredProducts)
      .where(inArray(featuredProducts.productId, ids))
      .groupBy(featuredProducts.productId),
    db
      .select({
        productId: votes.productId,
        poids: sql<number>`coalesce(sum(${votes.weight}), 0)::int`,
      })
      .from(votes)
      .where(and(inArray(votes.productId, ids), gte(votes.createdAt, since)))
      .groupBy(votes.productId),
    db
      .select({ productId: comments.productId, n: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(inArray(comments.productId, ids), gte(comments.createdAt, since)))
      .groupBy(comments.productId),
    db
      .select({ productId: reviews.productId, n: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(inArray(reviews.productId, ids), gte(reviews.createdAt, since)))
      .groupBy(reviews.productId),
  ]);
  const featMap = new Map(feats.map((f) => [f.productId, f]));
  const voteMap = new Map(votes7.map((v) => [v.productId, v.poids]));
  const commMap = new Map(comm7.map((c) => [c.productId, c.n]));
  const avisMap = new Map(avis7.map((a) => [a.productId, a.n]));

  // 3. La priorité de chaque candidat.
  const scored: (FeaturedCandidate & { row: (typeof rows)[number] })[] = rows.map((row) => {
    const feat = featMap.get(row.id);
    const apparitions = feat?.apparitions ?? 0;
    // Jamais mis en avant → l'attente court depuis sa publication (elle
    // est due depuis qu'il existe).
    const reference = feat?.dernier ?? (row.publishedAt ? utcDateString(row.publishedAt) : null);
    const attente = Math.min(joursEntre(reference, now), FEATURED_ATTENTE_PLAFOND_JOURS);
    const note = row.ratingsCount > 0 ? row.ratingsSum / row.ratingsCount : 0;
    const signal =
      note +
      (voteMap.get(row.id) ?? 0) +
      FEATURED_POIDS_COMMENTAIRE * (commMap.get(row.id) ?? 0) +
      FEATURED_POIDS_AVIS * (avisMap.get(row.id) ?? 0);
    return {
      id: row.id,
      signal,
      attente,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      row,
      apparitions,
    };
  });

  // 4. Le tri (fonction pure : deterministe, et PAS l'ordre d'arrivee).
  const winner = classerFeatured(scored)[0];
  if (!winner) return null;
  return { row: winner.row, tier: "rotation", productId: winner.row.id };
}

/**
 * Fiche : produits liés.
 *
 * ALGO : même catégorie primaire d'abord (par score) ; si la section est
 * trop maigre, on complète avec les **autres catégories** du produit
 * (sous-catégories), puis avec le **même type de produit** (les
 * alternatives). Sans ce repli, une fiche dans une catégorie vide
 * n'affiche aucun voisin — la section disparaît alors qu'il existe des
 * produits proches.
 */
export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 3,
  input?: { otherCategories?: string[]; productType?: string },
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
    /** Plateformes supportées (ids de la config). */
    platforms: string[];
    /** Veille : hors classement, votes désactivés. */
    curated: boolean;
    /** Catégorie du produit lié (le badge n'est plus affiché, mais le
     *  titre de section doit rester honnête). */
    categoryId: string;
  }>
> {
  // ALGO : même catégorie d'abord ; si la section est trop maigre, on
  // complète avec les AUTRES catégories du produit (sous-catégories), puis
  // avec le MÊME type de produit (les alternatives). Sans ça, une fiche
  // dans une catégorie vide n'affiche aucun produit voisin.
  const max = Math.min(Math.max(limit, 1), 6);
  const autresCategories = (input?.otherCategories ?? []).filter((c) => c !== categoryId);
  const productType = input?.productType ?? "";
  // Conditions communes. `and()` de Drizzle exige un premier argument
  // (tuple) : on passe donc les conditions additionnelles en fin de spread.
  const commun = (...extra: SQLWrapper[]): SQL =>
    and(
      eq(products.status, "published"),
      isNull(products.deletedAt),
      sql`${products.id} <> ${productId}::uuid`,
      ...extra,
    ) as SQL;
  const colonnes = {
    id: products.id,
    slug: products.slug,
    name: products.name,
    tagline: products.tagline,
    category: products.category,
    iconUrl: products.iconUrl,
    upvoteCount: products.upvoteCount,
    platforms: products.platforms,
    curated: products.curated,
    makerUsername: users.username,
    makerDisplayName: users.displayName,
    makerAvatarUrl: users.avatarUrl,
  };
  const parCategorie = await db
    .select(colonnes)
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(commun(eq(products.category, categoryId)))
    .orderBy(desc(products.score), desc(products.publishedAt))
    .limit(max);
  const vus = new Set(parCategorie.map((r) => r.id));
  let rows = parCategorie;
  if (rows.length < max && autresCategories.length > 0) {
    const vusIds = [...vus];
    const complement = await db
      .select(colonnes)
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .where(
        commun(
          inArray(products.category, autresCategories),
          // `notInArray` (et non un `ANY()` artisanal) : avec un seul
          // élément, un tableau passé en paramètre est sérialisé en
          // scalaire → « cannot cast type uuid to uuid[] » → la page
          // plante. `notInArray` gère le binding.
          ...(vusIds.length > 0 ? [notInArray(products.id, vusIds)] : []),
        ),
      )
      .orderBy(desc(products.score), desc(products.publishedAt))
      .limit(max - rows.length);
    for (const r of complement)
      if (!vus.has(r.id)) {
        rows = [...rows, r];
        vus.add(r.id);
      }
  }
  if (rows.length < max && productType !== "") {
    const complement = await db
      .select(colonnes)
      .from(products)
      .innerJoin(users, eq(products.makerId, users.id))
      .where(commun(sql`${products.productType} = ${productType}`))
      .orderBy(desc(products.score), desc(products.publishedAt))
      .limit(max * 2);
    for (const r of complement) {
      if (rows.length >= max) break;
      if (vus.has(r.id)) continue;
      rows = [...rows, r];
      vus.add(r.id);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    categoryId: r.category,
    iconUrl: r.iconUrl,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    votes: r.upvoteCount,
    platforms: r.platforms,
    curated: r.curated,
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
 * Pourquoi un slug n'est pas pinnable — staff uniquement.
 *
 * `setFeaturedOverride` renvoie un 404 volontairement indistinct (« pas
 * d'oracle »), ce qui est juste côté public mais frustrant pour l'admin qui a
 * tapé un slug. Réservé aux appelants déjà gardés par le rôle staff : rien
 * n'est révélé que le rôle ne voit déjà dans la liste produits.
 */
export type FeaturedSlugState =
  | { state: "ok"; productId: string }
  | { state: "missing" }
  | { state: "watch" }
  | { state: "notPublished" };

export async function resolveFeaturedSlug(slug: string): Promise<FeaturedSlugState> {
  const [row] = await db
    .select({
      id: products.id,
      status: products.status,
      curated: products.curated,
    })
    .from(products)
    .where(and(eq(products.slug, slug.toLowerCase()), isNull(products.deletedAt)))
    .limit(1);
  if (!row) return { state: "missing" };
  if (row.curated) return { state: "watch" };
  if (row.status !== "published") return { state: "notPublished" };
  return { state: "ok", productId: row.id };
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
