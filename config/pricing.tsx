import {
  Gift,
  Sparkle,
  Tag,
  ArrowsClockwise,
  ShoppingCart,
  Heart,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type PricingModel = {
  id: string;
  label: string;
  /** Description courte — tooltips facets, formulaire, fiche. */
  description: string;
  /** Placeholder prototype, comme `categories.count` (backend : count(*)). */
  count: number;
  /**
   * Accent de l'index `/categories`. Sémantique : gratuit/dons = pas de
   * revenu (emerald), payant/abonnement = or (le même or que le badge
   * `PAYANT`). Freemium reste neutre.
   */
  accentClass?: string;
  /** Icon component — render with weight="fill" at the desired size. */
  icon: Icon;
};

/**
 * Modèles économiques — source unique (PRD §8).
 * Utilisé par : submit-metadata-section, filtres, product card, facets.
 */
export const PRICING_MODELS: PricingModel[] = [
  {
    id: "free",
    label: "Gratuit",
    description: "100 % gratuit",
    count: 214,
    accentClass: "text-emerald-600 dark:text-emerald-400",
    icon: Gift,
  },
  {
    id: "freemium",
    label: "Freemium",
    description: "Gratuit avec options payantes",
    count: 96,
    icon: Sparkle,
  },
  {
    id: "paid",
    label: "Payant",
    description: "Payant à l'usage",
    count: 58,
    accentClass: "text-[#B58A43]",
    icon: Tag,
  },
  {
    id: "subscription",
    label: "Abonnement",
    description: "Abonnement récurrent",
    count: 143,
    accentClass: "text-[#B58A43]",
    icon: ArrowsClockwise,
  },
  {
    id: "one_time_purchase",
    label: "Achat unique",
    description: "Paiement unique",
    count: 37,
    accentClass: "text-[#B58A43]",
    icon: ShoppingCart,
  },
  {
    id: "open_source_donationware",
    label: "Open Source / Dons",
    description: "Libre, financé par dons",
    count: 42,
    accentClass: "text-emerald-600 dark:text-emerald-400",
    icon: Heart,
  },
];

export function getPricingById(id: string): PricingModel | undefined {
  return PRICING_MODELS.find((p) => p.id === id);
}

/** Monétisé = tout sauf gratuit et don (les stores exigent une privacy policy). */
export function isMonetizedPricing(id: string): boolean {
  return id !== "free" && id !== "open_source_donationware";
}
