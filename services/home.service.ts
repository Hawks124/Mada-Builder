import { getCatalog } from "@/services/catalog-mock.service";

/**
 * Données home / classement — source unique (nav, home teasers, /leaderboard).
 * Les classements s'appuient sur le catalogue partagé
 * (`services/catalog-mock.service`) : une seule source de produits pour
 * discover, les pages catégorie et les deux classements.
 */

export type RankingWindow = "today" | "week" | "month" | "all";

export const RANKING_WINDOWS: { id: RankingWindow; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "all", label: "Toujours" },
];

/**
 * Fenêtres valides (garde URL) — vit ici, module SANS "use client" :
 * l'importer depuis un composant client dans une page serveur donne un
 * stub vide (crash `.includes is not a function` constaté sur
 * /leaderboard). Jamais de valeur partagée via un module client.
 */
export const VALID_WINDOWS: RankingWindow[] = ["today", "week", "month", "all"];

export function getWindowLabel(window: RankingWindow): string {
  return RANKING_WINDOWS.find((w) => w.id === window)?.label ?? "Aujourd'hui";
}

export type RankedProduct = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  /** Type de produit (config/product-types) — filtre du classement taxon. */
  productType: string;
  maker: string;
  makerAvatar: string;
  votes: number;
  dailyVotes: number;
  comments: number;
  iconGradient: string;
  pricing: string;
  rating: string;
  initials: string;
};

export type FeaturedProductData = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  maker: string;
  /** Username maker (lien /makers/…) — défaut historique slugifié. */
  makerUsername?: string;
  makerAvatar: string;
  /** UUID produit (votes) — `id` reste le slug pour les liens. */
  productUuid?: string;
  initialVoted?: boolean;
  votes: number;
  comments: number;
  initials: string;
  /** Libellé éditorial fixe — produit du jour, pas rang live (PRD §11). */
  dateLabel: string;
  platforms: string[];
  pricingLabel: string;
  pricingDetail: string;
  ageRating: string;
  ageLabel: string;
  rating: string;
  reviewsCount: number;
};

const MOCK_FEATURED: FeaturedProductData = {
  id: "avotra-hr",
  name: "Avotra HR",
  tagline: "Le SIRH et système de paie automatisé certifié 100% droit du travail malgache.",
  categoryId: "employment",
  maker: "Kaliana R.",
  makerAvatar: "https://i.pravatar.cc/150?u=kaliana",
  votes: 342,
  comments: 58,
  initials: "AV",
  dateLabel: "Ven. 19 Sept. 2026",
  platforms: ["Web", "iOS", "Android"],
  pricingLabel: "Freemium",
  pricingDetail: "Dès 15.000Ar/mois",
  ageRating: "4+",
  ageLabel: "Grand public",
  rating: "4.9",
  reviewsCount: 120,
};

/** Produit du jour — #1 de la veille ou pick admin (PRD §11). Standalone, hors classement live. */
export function getFeatured(): FeaturedProductData {
  return MOCK_FEATURED;
}

/**
 * Copies déterministes pour que la pagination ait plusieurs pages à
 * afficher. Backend : le volume réel viendra de la requête, la logique de
 * copy disparaît — les signatures ci-dessous ne changent pas.
 */
const MOCK_COPIES = 8;

function buildRankedFromCatalog(): RankedProduct[] {
  return getCatalog().map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    categoryId: p.categoryId,
    productType: p.productType,
    maker: p.maker,
    makerAvatar: p.makerAvatar,
    votes: p.votes,
    dailyVotes: p.dailyVotes,
    comments: p.comments,
    iconGradient: p.iconGradient,
    pricing: p.pricing,
    rating: p.rating,
    initials: p.initials,
  }));
}

function withCopy(base: RankedProduct, copy: number, i: number): RankedProduct {
  if (copy === 0) return base;
  return {
    ...base,
    id: `${base.id}-x${copy + 1}`,
    name: `${base.name} ${copy + 1}`,
    votes: Math.max(3, base.votes - copy * 37 - i),
    dailyVotes: (base.dailyVotes + copy) % 21,
    comments: (base.comments + copy * 3) % 27,
  };
}

let rankedCache: RankedProduct[] | null = null;
function getRanked(): RankedProduct[] {
  if (rankedCache != null) return rankedCache;
  const base = buildRankedFromCatalog();
  const out: RankedProduct[] = [];
  for (let copy = 0; copy < MOCK_COPIES; copy++) {
    for (let i = 0; i < base.length; i++) out.push(withCopy(base[i]!, copy, i));
  }
  // Le catalogue est déjà trié par votes décroissants, donc l'ordre de
  // construction EST l'ordre du classement.
  rankedCache = out;
  return out;
}

/**
 * Classement CHRONOLOGIQUE — logique « qui monte en ce moment ».
 * Fenêtre temporelle (`today`/`week`/`month`/`all`) + score décroissant.
 * C'est la SEULE source du podium Top 10.
 */
export function getLeaderboard(window: RankingWindow): RankedProduct[] {
  void window; // fenêtre réelle = score Recency (PRD §11), pas encore en base
  return [...getRanked()];
}

/**
 * Classement TAXONOMIQUE — logique DISTINCTE : on classe par POIDS de la
 * facette (votes accumulés dans le domaine), pas par temps. Indépendant de
 * `?w=` par construction : changer la fenêtre temporelle ne touche pas
 * cette section, et inversement.
 */
export function getTaxonomyRanking(
  categoryId: string | null,
  productType: string | null,
): RankedProduct[] {
  return getRanked().filter(
    (p) =>
      (categoryId == null || p.categoryId === categoryId) &&
      (productType == null || p.productType === productType),
  );
}

/** Poids d'une taxonomie = total de ses votes (affichage « X »). */
export function getTaxonomyWeight(categoryId: string | null, productType: string | null): number {
  return getTaxonomyRanking(categoryId, productType).reduce((acc, p) => acc + p.votes, 0);
}
