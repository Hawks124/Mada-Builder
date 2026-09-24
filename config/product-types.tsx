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
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type ProductType = {
  id: string;
  label: string;
  icon: Icon;
};

/**
 * Types de produit — source unique (form submit, vérification admin,
 * filtres). Backend : enum product_type (PRD §8).
 */
export const PRODUCT_TYPES: ProductType[] = [
  { id: "app_mobile", label: "Application Mobile", icon: DeviceMobile },
  { id: "app_web", label: "Application Web", icon: Globe },
  { id: "app_desktop", label: "Application Desktop", icon: Monitor },
  { id: "cli", label: "Outil CLI", icon: Terminal },
  { id: "package", label: "Package / Librairie", icon: Package },
  { id: "framework", label: "Framework", icon: Stack },
  { id: "api", label: "API / Service Backend", icon: PlugsConnected },
  { id: "extension", label: "Extension Navigateur", icon: PuzzlePiece },
  { id: "os", label: "OS / Firmware", icon: Desktop },
  { id: "iot", label: "Hardware / IoT", icon: Lightning },
  { id: "bot", label: "Bot / Agent IA", icon: Robot },
  { id: "plugin", label: "Plugin / Addon", icon: Plugs },
  { id: "saas", label: "SaaS", icon: Cloud },
  { id: "other", label: "Autre", icon: SquaresFour },
];

export function getProductTypeById(id: string): ProductType {
  return PRODUCT_TYPES.find((t) => t.id === id) ?? PRODUCT_TYPES.find((t) => t.id === "other")!;
}
