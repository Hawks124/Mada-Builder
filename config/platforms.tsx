import {
  AppleLogo,
  AndroidLogo,
  Globe,
  Monitor,
  Terminal,
  WindowsLogo,
  LinuxLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type Platform = {
  id: string;
  label: string;
  /** Description courte — tooltips facets, formulaire, fiche. */
  description: string;
  /** Placeholder prototype, comme `categories.count` (backend : count(*)). */
  count: number;
  /**
   * Accent coloré de l'index `/categories` — le semis de couleur doit
   * rester rare : seulement les plateformes qu'on reconnaît déjà par leur
   * marque (Play, Web). Le reste reste monochrome.
   */
  accentClass?: string;
  icon: Icon;
};

/**
 * Plateformes supportées — source unique.
 * Utilisé par : submit-metadata-section, filtres, product cards, facets.
 */
export const PLATFORMS: Platform[] = [
  { id: "ios", label: "iOS", description: "iPhone et iPad", count: 164, icon: AppleLogo },
  { id: "macos", label: "macOS", description: "Mac", count: 27, icon: AppleLogo },
  {
    id: "android",
    label: "Android",
    description: "Smartphones et tablettes",
    count: 152,
    accentClass: "text-green-600 dark:text-green-400",
    icon: AndroidLogo,
  },
  {
    id: "web",
    label: "Web",
    description: "Navigateur",
    count: 238,
    accentClass: "text-sky-600 dark:text-sky-400",
    icon: Globe,
  },
  {
    id: "desktop",
    label: "Desktop",
    description: "Windows, macOS, Linux",
    count: 44,
    icon: Monitor,
  },
  {
    id: "cli",
    label: "CLI / API",
    description: "Terminal ou appel API",
    count: 51,
    icon: Terminal,
  },
  { id: "windows", label: "Windows", description: "PC Windows", count: 31, icon: WindowsLogo },
  { id: "linux", label: "Linux", description: "Distributions Linux", count: 12, icon: LinuxLogo },
];

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/**
 * Plateformes suggérées par type de produit (le formulaire les pré-coche
 * en création — décochables, jamais imposées : suggestion, pas friction).
 * Types absents = aucune suggestion (l'utilisateur choisit).
 */
export const PLATFORMS_BY_TYPE: Record<string, string[]> = {
  app_mobile: ["ios", "android"],
  app_web: ["web"],
  saas: ["web"],
  app_desktop: ["windows", "macos", "linux", "desktop"],
  cli: ["cli"],
  api: ["cli"],
  bot: ["web"],
  game: ["android", "ios", "web", "windows", "linux"],
};
