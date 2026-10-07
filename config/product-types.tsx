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

export type GalleryOrientation = "portrait" | "landscape";
/** Pilotage auto des captures : "both" = toggle actif (jeu, bot, autre). */
export type TypeOrientation = GalleryOrientation | "both";

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
  /**
   * Orientation imposée des captures : un SaaS desktop ou un CLI en
   * portrait n'existe pas — le type pilote, pas l'utilisateur. "both"
   * (web — desktop ET phone —, jeu, bot, autre) = toggle actif, avec
   * `defaultOrientation` comme point de départ.
   */
  orientation: TypeOrientation;
  /** Orientation initiale quand `orientation` vaut "both". */
  defaultOrientation?: GalleryOrientation;
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
    orientation: "portrait",
  },
  {
    id: "app_web",
    label: "App Web",
    description: "Application web",
    count: 121,
    icon: Globe,
    // Desktop ET phone : l'utilisateur choisit (défaut paysage).
    orientation: "both",
    defaultOrientation: "landscape",
  },
  {
    id: "app_desktop",
    label: "App Desktop",
    description: "Logiciel pour ordinateur",
    count: 34,
    icon: Monitor,
    orientation: "landscape",
  },
  {
    id: "cli",
    label: "Outil CLI",
    description: "Ligne de commande",
    count: 28,
    icon: Terminal,
    orientation: "landscape",
  },
  {
    id: "package",
    label: "Package / Librairie",
    description: "npm, pip, crate",
    count: 41,
    icon: Package,
    orientation: "landscape",
  },
  {
    id: "framework",
    label: "Framework",
    description: "Socle de développement",
    count: 12,
    icon: Stack,
    orientation: "landscape",
  },
  {
    id: "api",
    label: "API / Service Backend",
    description: "Service ou API publique",
    count: 47,
    icon: PlugsConnected,
    orientation: "landscape",
  },
  {
    id: "extension",
    label: "Extension Navigateur",
    description: "Extension Chrome, Firefox",
    count: 15,
    icon: PuzzlePiece,
    orientation: "landscape",
  },
  {
    id: "os",
    label: "OS / Firmware",
    description: "Système ou firmware",
    count: 6,
    icon: Desktop,
    orientation: "landscape",
  },
  {
    id: "iot",
    label: "Hardware / IoT",
    description: "Matériel et objets connectés",
    count: 19,
    icon: Lightning,
    orientation: "landscape",
  },
  {
    id: "bot",
    label: "Bot / Agent IA",
    description: "Agent autonome",
    count: 23,
    icon: Robot,
    orientation: "both",
  },
  {
    id: "plugin",
    label: "Plugin / Addon",
    description: "Extension tierce",
    count: 9,
    icon: Plugs,
    orientation: "landscape",
  },
  {
    id: "saas",
    label: "SaaS",
    description: "Logiciel en abonnement",
    count: 78,
    icon: Cloud,
    orientation: "landscape",
  },
  {
    id: "game",
    label: "Jeu vidéo",
    description: "Jeu PC, mobile ou console",
    count: 22,
    icon: GameController,
    orientation: "both",
  },
  {
    id: "other",
    label: "Autre",
    description: "Tout ce qui reste",
    count: 9,
    icon: SquaresFour,
    orientation: "both",
  },
];

export function getProductTypeById(id: string): ProductType {
  return PRODUCT_TYPES.find((t) => t.id === id) ?? PRODUCT_TYPES.find((t) => t.id === "other")!;
}
