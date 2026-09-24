import {
  AppleLogo,
  AndroidLogo,
  Globe,
  Monitor,
  Terminal,
  WindowsLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type Platform = {
  id: string;
  label: string;
  icon: Icon;
};

/**
 * Plateformes supportées — source unique.
 * Utilisé par : submit-metadata-section, filter-sheet, product cards.
 */
export const PLATFORMS: Platform[] = [
  { id: "ios",     label: "iOS",       icon: AppleLogo },
  { id: "macos",   label: "macOS",     icon: AppleLogo },
  { id: "android", label: "Android",   icon: AndroidLogo },
  { id: "web",     label: "Web",       icon: Globe },
  { id: "desktop", label: "Desktop",   icon: Monitor },
  { id: "cli",     label: "CLI / API", icon: Terminal },
  { id: "windows", label: "Windows",   icon: WindowsLogo },
];

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}
