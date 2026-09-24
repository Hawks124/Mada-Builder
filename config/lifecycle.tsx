import { HammerIcon, FlaskIcon, RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Avancement produit — distinct du statut de revue (pending/published/
 * rejected, PRD §8). Pilote l'affichage fiche, rows publiques et newest.
 * Backend : champ `lifecycle` enum sur products.
 */
export type LifecycleId = "dev" | "beta" | "live";

export type LifecycleStatus = {
  id: LifecycleId;
  label: string;
  description: string;
  icon: Icon;
  /** Pill teintée (reviews, rows publiques, sidebar détail). */
  pillClass: string;
  /** Texte seul teinté (micro-lignes dashboard, sans pill). */
  textClass: string;
};

export const DEFAULT_LIFECYCLE_ID: LifecycleId = "live";

export const LIFECYCLE_STATUS: LifecycleStatus[] = [
  {
    id: "dev",
    label: "En développement",
    description: "Encore en chantier, pas utilisable",
    icon: HammerIcon,
    pillClass: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "beta",
    label: "Bêta",
    description: "Testable, en phase de test",
    icon: FlaskIcon,
    pillClass: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    textClass: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "live",
    label: "Lancé",
    description: "En production, utilisable",
    icon: RocketLaunchIcon,
    pillClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
];

export function getLifecycleById(id: string): LifecycleStatus {
  return (
    LIFECYCLE_STATUS.find((s) => s.id === id) ??
    LIFECYCLE_STATUS.find((s) => s.id === DEFAULT_LIFECYCLE_ID)!
  );
}
