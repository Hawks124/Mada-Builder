/**
 * Mock du panel admin — typé pour brancher Drizzle + session admin
 * sans changer les composants. Modération = ban réversible par défaut,
 * jamais de suppression user (anti-trauma-stores). La suppression
 * produit manuelle reste l'arme lourde (confirm + détails).
 */
export type AdminUserStatus = "active" | "banned";

export type AdminUserProduct = {
  id: string;
  initials: string;
  iconGradient: string;
};

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
  provider: "github" | "google";
  socials: { github?: string; x?: string; website?: string };
  role: "admin" | "user";
  status: AdminUserStatus;
  banReason?: string;
  appeals: number;
  products: AdminUserProduct[];
  joinedText: string;
};

export type ReviewLink = {
  label: string;
  href: string;
  icon: "globe" | "apple" | "play" | "github" | "shield" | "file";
};

export type ReviewItem = {
  id: string;
  productName: string;
  tagline: string;
  description: string;
  makerName: string;
  makerUsername: string;
  makerAvatar: string;
  makerLiveCount: number;
  makerBans: number;
  /** Toutes les catégories choisies (1-3) — [0] = principale. */
  categoryIds: string[];
  productTypeId: string;
  platforms: string[];
  audienceId: string;
  /** URL sécu enfants — requise si audience kids. */
  kidsPolicyUrl?: string;
  pricing: string;
  version?: string;
  license?: string;
  installCommand?: string;
  hasAds: boolean;
  sharesData: boolean;
  lifecycle: "dev" | "beta" | "live";
  tags: string[];
  links: ReviewLink[];
  iconGradient: string;
  initials: string;
  /** Captures fournies (0 = slot "Non fourni"). */
  screenshots: number;
  waitingText: string;
  /** Heures d'attente — SLA 24 h (→ published_at backend). */
  waitingHours: number;
  revenue?: { provider: "stripe" | "revenuecat"; mrrAr: number };
};

export type ActivitySubject =
  | { type: "product"; productId: string }
  | { type: "provider"; provider: "stripe" | "revenuecat" }
  | { type: "users"; avatars: string[]; extra: number };

export type ActivityItem = {
  id: string;
  text: string;
  time: string;
  tone: "neutral" | "success" | "warning" | "danger";
  /** Cible de navigation — l'activité se clique, pas juste se lit. */
  href: string;
  subject: ActivitySubject;
};

export const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: "u-kaliana",
    username: "kaliana",
    displayName: "Kaliana R.",
    avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
    email: "kaliana@mail.com",
    provider: "github",
    socials: {
      github: "https://github.com/kaliana",
      x: "https://x.com/kaliana",
      website: "https://kaliana.dev",
    },
    role: "admin",
    status: "active",
    appeals: 0,
    products: [
      { id: "avotra-hr", initials: "AV", iconGradient: "from-zinc-800 to-zinc-950" },
      { id: "tsena-connect", initials: "TC", iconGradient: "from-emerald-500 to-teal-600" },
      { id: "vatsy", initials: "VA", iconGradient: "from-blue-600 to-indigo-600" },
      { id: "paye-malagasy", initials: "PM", iconGradient: "from-orange-500 to-amber-600" },
      { id: "kairos", initials: "KA", iconGradient: "from-teal-500 to-cyan-600" },
      { id: "sakafo-mada", initials: "SM", iconGradient: "from-yellow-500 to-orange-500" },
    ],
    joinedText: "janv. 2026",
  },
  {
    id: "u-bryl",
    username: "bryl",
    displayName: "Bryl Lim",
    avatarUrl: "https://i.pravatar.cc/150?u=bryl",
    email: "bryl@mail.com",
    provider: "github",
    socials: { github: "https://github.com/bryl" },
    role: "user",
    status: "active",
    appeals: 0,
    products: [
      { id: "tarsi", initials: "TA", iconGradient: "from-blue-600 to-indigo-700" },
      { id: "tsenabora", initials: "TS", iconGradient: "from-cyan-500 to-sky-600" },
      { id: "mvola-check", initials: "MV", iconGradient: "from-green-500 to-emerald-600" },
    ],
    joinedText: "févr. 2026",
  },
  {
    id: "u-jas",
    username: "jas",
    displayName: "Jas",
    avatarUrl: "https://i.pravatar.cc/150?u=jas",
    email: "jas@mail.com",
    provider: "google",
    socials: {},
    role: "user",
    status: "active",
    appeals: 0,
    products: [
      { id: "moranotes", initials: "MN", iconGradient: "from-violet-500 to-purple-600" },
    ],
    joinedText: "mars 2026",
  },
  {
    id: "u-arvin",
    username: "arvin",
    displayName: "Arvin",
    avatarUrl: "https://i.pravatar.cc/150?u=arvin",
    provider: "github",
    socials: {
      github: "https://github.com/arvin",
      website: "https://arvin.dev",
    },
    role: "user",
    status: "active",
    appeals: 0,
    products: [
      { id: "anong-ulam", initials: "AU", iconGradient: "from-amber-400 to-orange-500" },
      { id: "sakafo-plus", initials: "SP", iconGradient: "from-lime-500 to-green-600" },
    ],
    joinedText: "avr. 2026",
  },
  {
    id: "u-cryptopromo",
    username: "cryptopromo",
    displayName: "CryptoPromo MG",
    avatarUrl: "https://i.pravatar.cc/150?u=cryptopromo",
    email: "promo@cryptopromo.mg",
    provider: "google",
    socials: {},
    role: "user",
    status: "banned",
    banReason: "Spam — liens d'affiliation hors sujet",
    appeals: 2,
    products: [],
    joinedText: "sept. 2026",
  },
];

export type AdminProductMaker = {
  name: string;
  username: string;
  avatarUrl: string;
};

export type AdminProduct = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  productType: string;
  platforms: string[];
  audienceId: string;
  pricing: string;
  version?: string;
  launchedAt: string;
  /** → published_at (tri Plus récents / anciens). */
  publishedTs: number;
  tags: string[];
  lifecycle: "dev" | "beta" | "live";
  votes: number;
  views: number;
  rating: number;
  revenue?: { provider: "stripe" | "revenuecat"; mrrAr: number };
  iconGradient: string;
  initials: string;
  maker: AdminProductMaker;
};

/** Ordre de tri pricing : accessible → payant. */
export const PRICING_ORDER: Record<string, number> = {
  Gratuit: 0,
  Freemium: 1,
  Abonnement: 2,
  Payant: 3,
};

/** Requête plateforme (tous makers) — distincte de "mes apps". */
export const ADMIN_PRODUCTS: AdminProduct[] = [
  {
    id: "avotra-hr",
    name: "Avotra HR",
    tagline: "SIRH et paie automatisée, 100% droit malgache.",
    categoryId: "employment",
    productType: "SaaS",
    platforms: ["web", "ios", "android"],
    audienceId: "all",
    pricing: "Freemium",
    version: "v2.4.1",
    launchedAt: "mars 2026",
    publishedTs: 1772323200,
    tags: ["sirh", "paie", "b2b"],
    lifecycle: "live",
    votes: 342,
    views: 12400,
    rating: 4.9,
    revenue: { provider: "stripe", mrrAr: 1200000 },
    iconGradient: "from-zinc-800 to-zinc-950",
    initials: "AV",
    maker: {
      name: "Kaliana R.",
      username: "kaliana",
      avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
    },
  },
  {
    id: "tarsi",
    name: "Tarsi",
    tagline: "Your Personal Finance Companion.",
    categoryId: "finance",
    productType: "Application Mobile",
    platforms: ["ios", "android"],
    audienceId: "all",
    pricing: "Freemium",
    version: "v3.0.0",
    launchedAt: "janvier 2026",
    publishedTs: 1767225600,
    tags: ["budget", "MGA", "offline"],
    lifecycle: "live",
    votes: 512,
    views: 18400,
    rating: 5.0,
    iconGradient: "from-blue-600 to-indigo-700",
    initials: "TA",
    maker: {
      name: "Bryl Lim",
      username: "bryl",
      avatarUrl: "https://i.pravatar.cc/150?u=bryl",
    },
  },
  {
    id: "tsena-connect",
    name: "TsenaConnect",
    tagline: "Le marché artisanal malgache en ligne.",
    categoryId: "ecommerce",
    productType: "Application Web",
    platforms: ["web"],
    audienceId: "all",
    pricing: "Gratuit",
    launchedAt: "janvier 2026",
    publishedTs: 1764547200,
    tags: ["marketplace", "artisanat"],
    lifecycle: "live",
    votes: 187,
    views: 8300,
    rating: 4.7,
    iconGradient: "from-emerald-500 to-teal-600",
    initials: "TC",
    maker: {
      name: "Kaliana R.",
      username: "kaliana",
      avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
    },
  },
  {
    id: "vatsy",
    name: "Vatsy",
    tagline: "Épargne mobile-money sans friction.",
    categoryId: "fintech",
    productType: "Application Mobile",
    platforms: ["ios", "android"],
    audienceId: "teens",
    pricing: "Freemium",
    version: "v1.9.0",
    launchedAt: "novembre 2025",
    publishedTs: 1761955200,
    tags: ["epargne", "mobile-money"],
    lifecycle: "beta",
    votes: 96,
    views: 4100,
    rating: 4.8,
    revenue: { provider: "revenuecat", mrrAr: 320000 },
    iconGradient: "from-blue-600 to-indigo-600",
    initials: "VA",
    maker: {
      name: "Kaliana R.",
      username: "kaliana",
      avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
    },
  },
  {
    id: "anong-ulam",
    name: "Anong Ulam?",
    tagline: "AI-powered food generator.",
    categoryId: "lifestyle",
    productType: "Application Web",
    platforms: ["web"],
    audienceId: "all",
    pricing: "Gratuit",
    launchedAt: "décembre 2025",
    publishedTs: 1764547200,
    tags: ["food", "ia"],
    lifecycle: "live",
    votes: 54,
    views: 2100,
    rating: 4.5,
    iconGradient: "from-amber-400 to-orange-500",
    initials: "AU",
    maker: {
      name: "Arvin",
      username: "arvin",
      avatarUrl: "https://i.pravatar.cc/150?u=arvin",
    },
  },
  {
    id: "sakafo-mada",
    name: "Sakafo Mada",
    tagline: "Recettes malgaches, mode hors-ligne.",
    categoryId: "food",
    productType: "Application Mobile",
    platforms: ["ios", "android"],
    audienceId: "all",
    pricing: "Gratuit",
    version: "v3.2.0",
    launchedAt: "juin 2025",
    publishedTs: 1748736000,
    tags: ["recettes", "hors-ligne"],
    lifecycle: "live",
    votes: 58,
    views: 2300,
    rating: 4.6,
    iconGradient: "from-yellow-500 to-orange-500",
    initials: "SM",
    maker: {
      name: "Kaliana R.",
      username: "kaliana",
      avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
    },
  },
];

export const MOCK_REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "paye-malagasy",
    productName: "PayeMalagasy",
    tagline: "Bulletins de paie conformes CNAPS & OSTIE.",
    description:
      "PayeMalagasy génère des bulletins de paie conformes au droit malgache (CNAPS, OSTIE, IRSA) pour les PME. Import des employés via CSV, calculs automatiques, export PDF.",
    makerName: "Kaliana R.",
    makerUsername: "kaliana",
    makerAvatar: "https://i.pravatar.cc/150?u=kaliana",
    makerLiveCount: 4,
    makerBans: 0,
    categoryIds: ["fintech", "saas"],
    productTypeId: "saas",
    platforms: ["web", "ios"],
    audienceId: "all",
    pricing: "Abonnement",
    version: "v1.0.0",
    license: "Propriétaire",
    hasAds: false,
    sharesData: false,
    lifecycle: "live",
    tags: ["paie", "compliance", "b2b"],
    links: [
      { label: "Site web", href: "https://payemalagasy.com", icon: "globe" },
      { label: "GitHub", href: "https://github.com/kaliana/paye", icon: "github" },
      { label: "Confidentialité", href: "https://payemalagasy.com/privacy", icon: "shield" },
    ],
    iconGradient: "from-orange-500 to-amber-600",
    initials: "PM",
    screenshots: 3,
    waitingText: "En attente depuis 2 j",
    waitingHours: 48,
    revenue: { provider: "stripe", mrrAr: 85000 },
  },
  {
    id: "tsenabora",
    productName: "Tsenabora",
    tagline: "Guides touristiques audio hors-ligne.",
    description:
      "Tsenabora propose des guides audio géolocalisés pour les sites touristiques malgaches, téléchargeables pour une utilisation sans connexion.",
    makerName: "Bryl Lim",
    makerUsername: "bryl",
    makerAvatar: "https://i.pravatar.cc/150?u=bryl",
    makerLiveCount: 2,
    makerBans: 0,
    categoryIds: ["travel"],
    productTypeId: "app_mobile",
    platforms: ["ios", "android"],
    audienceId: "all",
    pricing: "Gratuit",
    license: "MIT",
    installCommand: undefined,
    hasAds: true,
    sharesData: false,
    lifecycle: "live",
    tags: ["tourisme", "audio"],
    links: [
      { label: "Site web", href: "https://tsenabora.mg", icon: "globe" },
      {
        label: "Google Play",
        href: "https://play.google.com/store/apps/details?id=tsenabora",
        icon: "play",
      },
    ],
    iconGradient: "from-cyan-500 to-sky-600",
    initials: "TS",
    screenshots: 2,
    waitingText: "En attente depuis 5 h",
    waitingHours: 5,
  },
  {
    id: "moranotes",
    productName: "MoraNotes",
    tagline: "Notes minimalistes, sync instantanée.",
    description:
      "MoraNotes est un bloc-notes épuré avec synchronisation temps réel et mode hors-ligne, pensé pour la prise de notes rapide au quotidien.",
    makerName: "Jas",
    makerUsername: "jas",
    makerAvatar: "https://i.pravatar.cc/150?u=jas",
    makerLiveCount: 1,
    makerBans: 0,
    categoryIds: ["productivity", "education"],
    productTypeId: "app_web",
    platforms: ["web"],
    audienceId: "kids",
    kidsPolicyUrl: "https://moranotes.app/kids-safety",
    pricing: "Gratuit",
    hasAds: false,
    sharesData: true,
    lifecycle: "beta",
    tags: ["notes"],
    links: [{ label: "Site web", href: "https://moranotes.app", icon: "globe" }],
    iconGradient: "from-violet-500 to-purple-600",
    initials: "MN",
    screenshots: 0,
    waitingText: "En attente depuis 1 h",
    waitingHours: 1,
  },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    text: "PayeMalagasy soumise par Kaliana R.",
    time: "il y a 2 h",
    tone: "warning",
    href: "/admin/review/paye-malagasy",
    subject: { type: "product", productId: "paye-malagasy" },
  },
  {
    id: "a2",
    text: "Avotra HR a dépassé 300 votes",
    time: "il y a 5 h",
    tone: "success",
    href: "/products/avotra-hr",
    subject: { type: "product", productId: "avotra-hr" },
  },
  {
    id: "a3",
    text: "Sync Stripe OK — 4 produits",
    time: "il y a 8 h",
    tone: "success",
    href: "/dashboard/api",
    subject: { type: "provider", provider: "stripe" },
  },
  {
    id: "a4",
    text: "Kairos rejetée — captures manquantes",
    time: "hier",
    tone: "danger",
    href: "/admin/users",
    subject: { type: "product", productId: "kairos" },
  },
  {
    id: "a5",
    text: "+12 makers inscrits cette semaine",
    time: "hier",
    tone: "neutral",
    href: "/admin/users",
    subject: {
      type: "users",
      avatars: [
        "https://i.pravatar.cc/150?u=n1",
        "https://i.pravatar.cc/150?u=n2",
        "https://i.pravatar.cc/150?u=n3",
      ],
      extra: 9,
    },
  },
];
