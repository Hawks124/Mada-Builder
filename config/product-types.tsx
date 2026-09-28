import {
  DeviceMobile,
  Globe,
  Monitor,
  Terminal,
  Package,
  Stack,
  PlugsConnected,
  PuzzlePiece,
  Desktop,
  Lightning,
  Robot,
  Plugs,
  Cloud,
  GameController,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type ProductType = {
  id: string;
  label: string;
  /** Description courte — tooltips facets, formulaires, fiche. */
  description: string;
  /**
   * Nombre de produits (placeholder prototype, comme `categories.count` —
   * remplacé par le `WHERE count(*)` du backend). Sert à habiter la colonne
   * de droite des index, sinon la ligne paraît amputée.
   */
  count: number;
  icon: Icon;
};

/**
 * Types de produit — source unique (form submit, vérification admin,
 * filtres, page /categories). Backend : enum product_type (PRD §8).
 */
export const PRODUCT_TYPES: ProductType[] = [
  {
    id: "app_mobile",
    label: "App Mobile",
    description: "Application iOS et Android",
    count: 186,
    icon: DeviceMobile,
  },
  { id: "app_web", label: "App Web", description: "Application web", count: 121, icon: Globe },
  {
    id: "app_desktop",
    label: "App Desktop",
    description: "Logiciel pour ordinateur",
    count: 34,
    icon: Monitor,
  },
  { id: "cli", label: "Outil CLI", description: "Ligne de commande", count: 28, icon: Terminal },
  {
    id: "package",
    label: "Package / Librairie",
    description: "npm, pip, crate",
    count: 41,
    icon: Package,
  },
  {
    id: "framework",
    label: "Framework",
    description: "Socle de développement",
    count: 12,
    icon: Stack,
  },
  {
    id: "api",
    label: "API / Service Backend",
    description: "Service ou API publique",
    count: 47,
    icon: PlugsConnected,
  },
  {
    id: "extension",
    label: "Extension Navigateur",
    description: "Extension Chrome, Firefox",
    count: 15,
    icon: PuzzlePiece,
  },
  { id: "os", label: "OS / Firmware", description: "Système ou firmware", count: 6, icon: Desktop },
  {
    id: "iot",
    label: "Hardware / IoT",
    description: "Matériel et objets connectés",
    count: 19,
    icon: Lightning,
  },
  { id: "bot", label: "Bot / Agent IA", description: "Agent autonome", count: 23, icon: Robot },
  { id: "plugin", label: "Plugin / Addon", description: "Extension tierce", count: 9, icon: Plugs },
  { id: "saas", label: "SaaS", description: "Logiciel en abonnement", count: 78, icon: Cloud },
  {
    id: "game",
    label: "Jeu vidéo",
    description: "Jeu PC, mobile ou console",
    count: 22,
    icon: GameController,
  },
  { id: "other", label: "Autre", description: "Tout ce qui reste", count: 9, icon: SquaresFour },
];

export function getProductTypeById(id: string): ProductType {
  return PRODUCT_TYPES.find((t) => t.id === id) ?? PRODUCT_TYPES.find((t) => t.id === "other")!;
}
