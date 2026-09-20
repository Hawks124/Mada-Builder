/**
 * Mock du dashboard maker — typé pour brancher Drizzle + session
 * sans changer les composants (PRD §8 : products, revenue_connections).
 */
export type AppStatus = "live" | "pending" | "rejected";

export type DashboardRevenue = {
  provider: "stripe" | "revenuecat";
  mrrAr: number;
  /** §12 display_mode — badge_only masque le chiffre exact en public. */
  displayMode?: "full" | "badge_only";
};

export type DashboardApp = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  productType: string;
  /** → product_type enum (ids du Select). */
  productTypeId: string;
  platforms: string[];
  /** → target_audience / config/ratings. */
  audienceId: string;
  pricing: string;
  version?: string;
  /** → champ lifecycle enum (dev | beta | live). */
  lifecycle: "dev" | "beta" | "live";
  /** → published_at. Format éditorial FR. */
  launchedAt: string;
  tags: string[];
  waitingText?: string;
  votes: number;
  views: number;
  comments: number;
  rating: number;
  ratingsCount: number;
  status: AppStatus;
  rejectionReason?: string;
  revenue?: DashboardRevenue;
  iconGradient: string;
  initials: string;
};

export const STATUS_META: Record<
  AppStatus,
  { label: string; pillClass: string }
> = {
  live: {
    label: "En ligne",
    pillClass:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    label: "En revue",
    pillClass:
      "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  rejected: {
    label: "Rejetée",
    pillClass: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export const MOCK_APPS: DashboardApp[] = [
  {
    id: "avotra-hr",
    productTypeId: "saas",
    name: "Avotra HR",
    tagline: "SIRH et paie automatisée, 100% droit malgache.",
    categoryId: "employment",
    productType: "SaaS",
    platforms: ["web", "ios", "android"],
    audienceId: "all",
    pricing: "Freemium",
    version: "v2.4.1",
    launchedAt: "mars 2026",
    lifecycle: "live",
    tags: ["sirh", "paie", "b2b"],
    votes: 342,
    views: 12400,
    comments: 58,
    rating: 4.9,
    ratingsCount: 120,
    status: "live",
    revenue: { provider: "stripe", mrrAr: 1200000 },
    iconGradient: "from-zinc-800 to-zinc-950",
    initials: "AV",
  },
  {
    id: "tsena-connect",
    productTypeId: "app_web",
    name: "TsenaConnect",
    tagline: "Le marché artisanal malgache en ligne.",
    categoryId: "ecommerce",
    productType: "Application Web",
    platforms: ["web"],
    audienceId: "all",
    pricing: "Gratuit",
    launchedAt: "janvier 2026",
    lifecycle: "live",
    tags: ["marketplace", "artisanat"],
    votes: 187,
    views: 8300,
    comments: 24,
    rating: 4.7,
    ratingsCount: 64,
    status: "live",
    iconGradient: "from-emerald-500 to-teal-600",
    initials: "TC",
  },
  {
    id: "vatsy",
    productTypeId: "app_mobile",
    name: "Vatsy",
    tagline: "Épargne mobile-money sans friction.",
    categoryId: "fintech",
    productType: "Application Mobile",
    platforms: ["ios", "android"],
    audienceId: "teens",
    pricing: "Freemium",
    version: "v1.9.0",
    launchedAt: "novembre 2025",
    lifecycle: "beta",
    tags: ["epargne", "mobile-money"],
    votes: 96,
    views: 4100,
    comments: 12,
    rating: 4.8,
    ratingsCount: 31,
    status: "live",
    revenue: {
      provider: "revenuecat",
      mrrAr: 320000,
      displayMode: "badge_only",
    },
    iconGradient: "from-blue-600 to-indigo-600",
    initials: "VA",
  },
  {
    id: "paye-malagasy",
    productTypeId: "saas",
    name: "PayeMalagasy",
    tagline: "Bulletins de paie conformes CNAPS & OSTIE.",
    categoryId: "fintech",
    productType: "SaaS",
    platforms: ["web", "ios"],
    audienceId: "all",
    pricing: "Abonnement",
    launchedAt: "septembre 2026",
    lifecycle: "dev",
    tags: ["paie", "compliance"],
    waitingText: "En attente depuis 2 j",
    votes: 0,
    views: 0,
    comments: 0,
    rating: 0,
    ratingsCount: 0,
    status: "pending",
    iconGradient: "from-orange-500 to-amber-600",
    initials: "PM",
  },
  {
    id: "kairos",
    productTypeId: "app_web",
    name: "Kairos",
    tagline: "Gestion du temps pour freelances.",
    categoryId: "productivity",
    productType: "Application Web",
    platforms: ["web"],
    audienceId: "all",
    pricing: "Gratuit",
    launchedAt: "septembre 2026",
    lifecycle: "dev",
    tags: ["temps", "freelance"],
    votes: 0,
    views: 0,
    comments: 0,
    rating: 0,
    ratingsCount: 0,
    status: "rejected",
    rejectionReason: "Captures d'écran manquantes — ajoutez au moins 1 visuel.",
    iconGradient: "from-teal-500 to-cyan-600",
    initials: "KA",
  },
  {
    id: "sakafo-mada",
    productTypeId: "app_mobile",
    name: "Sakafo Mada",
    tagline: "Recettes malgaches, mode hors-ligne.",
    categoryId: "food",
    productType: "Application Mobile",
    platforms: ["ios", "android"],
    audienceId: "all",
    pricing: "Gratuit",
    version: "v3.2.0",
    launchedAt: "juin 2025",
    lifecycle: "live",
    tags: ["recettes", "hors-ligne"],
    votes: 58,
    views: 2300,
    comments: 9,
    rating: 4.6,
    ratingsCount: 22,
    status: "live",
    iconGradient: "from-yellow-500 to-orange-500",
    initials: "SM",
  },
];

export type DashboardTotals = {
  totalUpvotes: number;
  liveCount: number;
  totalListings: number;
  totalViews: number;
  pendingCount: number;
  totalMrrAr: number;
  totalComments: number;
  globalRating: number;
};

export function getDashboardTotals(apps: DashboardApp[]): DashboardTotals {
  const totalRatings = apps.reduce((acc, a) => acc + a.ratingsCount, 0);
  const weightedSum = apps.reduce(
    (acc, a) => acc + a.rating * a.ratingsCount,
    0,
  );
  return {
    totalUpvotes: apps.reduce((acc, a) => acc + a.votes, 0),
    liveCount: apps.filter((a) => a.status === "live").length,
    totalListings: apps.length,
    totalViews: apps.reduce((acc, a) => acc + a.views, 0),
    pendingCount: apps.filter((a) => a.status === "pending").length,
    totalMrrAr: apps.reduce((acc, a) => acc + (a.revenue?.mrrAr ?? 0), 0),
    totalComments: apps.reduce((acc, a) => acc + a.comments, 0),
    globalRating:
      totalRatings > 0
        ? Math.round((weightedSum / totalRatings) * 10) / 10
        : 0,
  };
}

export function formatCompactCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  }
  return `${n}`;
}

export function formatCompactAr(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M Ar`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k Ar`;
  }
  return `${n} Ar`;
}
