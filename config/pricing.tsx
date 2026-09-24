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
  /** Icon component — render with weight="fill" at the desired size. */
  icon: Icon;
};

/**
 * Modèles économiques — source unique (PRD §8).
 * Utilisé par : submit-metadata-section (Select dropdown),
 *              filter-sheet (chips), product-card (badge).
 */
export const PRICING_MODELS: PricingModel[] = [
  { id: "free", label: "Gratuit", icon: Gift },
  { id: "freemium", label: "Freemium", icon: Sparkle },
  { id: "paid", label: "Payant", icon: Tag },
  { id: "subscription", label: "Abonnement", icon: ArrowsClockwise },
  { id: "one_time_purchase", label: "Achat unique", icon: ShoppingCart },
  { id: "open_source_donationware", label: "Open Source / Dons", icon: Heart },
];

export function getPricingById(id: string): PricingModel | undefined {
  return PRICING_MODELS.find((p) => p.id === id);
}
