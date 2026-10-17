import { readFile } from "node:fs/promises";
import path from "node:path";
import { slugifyHeading } from "@/lib/slug";
import type { RevenueProviderId } from "@/services/revenue/types";

/**
 * Guides makers (contenu piloté par markdown, rendu `Prose` + `DocLayout`).
 * Fichiers dans `content/guides/`, jamais de JSX dans le contenu.
 */

const DIR = path.join(process.cwd(), "content", "guides");

export type GuideSlug = "revenus-verifies" | RevenueGuideProviderSlug;
export type RevenueGuideProviderSlug =
  "stripe" | "revenuecat" | "paddle" | "polar" | "lemon-squeezy";

const PROVIDER_FILE: Record<RevenueGuideProviderSlug, RevenueProviderId> = {
  stripe: "stripe",
  revenuecat: "revenuecat",
  paddle: "paddle",
  polar: "polar",
  "lemon-squeezy": "lemon_squeezy",
};

export const REVENUE_GUIDE_SLUGS = Object.keys(PROVIDER_FILE) as RevenueGuideProviderSlug[];

export function providerIdForGuideSlug(slug: RevenueGuideProviderSlug): RevenueProviderId {
  return PROVIDER_FILE[slug];
}

const GUIDE_FILES: Record<string, string> = {
  "revenus-verifies": "revenus-verifies.md",
  stripe: "revenus-verifies-stripe.md",
  revenuecat: "revenus-verifies-revenuecat.md",
  paddle: "revenus-verifies-paddle.md",
  polar: "revenus-verifies-polar.md",
  "lemon-squeezy": "revenus-verifies-lemon-squeezy.md",
  "signature-apk": "signature-apk.md",
  "signature-apk-android": "signature-apk-android.md",
  "signature-apk-flutter": "signature-apk-flutter.md",
  "signature-apk-react-native": "signature-apk-react-native.md",
  "signature-apk-expo": "signature-apk-expo.md",
  "signature-apk-capacitor": "signature-apk-capacitor.md",
  "signature-apk-depannage": "signature-apk-depannage.md",
};

export type SignatureApkGuideSlug =
  | "signature-apk"
  | "signature-apk-android"
  | "signature-apk-flutter"
  | "signature-apk-react-native"
  | "signature-apk-expo"
  | "signature-apk-capacitor"
  | "signature-apk-depannage";

/**
 * Fiches « signature APK » : hub sans logo, 5 frameworks avec logo officiel
 * (`public/logos/`, glyphes simple-icons), dépannage sans logo. `dark: true`
 * = glyphe coloré → inversé en thème sombre, comme les providers revenus
 * (`dark:brightness-0 dark:invert`).
 */
export const SIGNATURE_APK_GUIDE_META = {
  "signature-apk": {
    label: "Vue d'ensemble",
    short: "Les trois schémas de signature v1/v2/v3, le keystore et le vocabulaire commun.",
    logo: undefined,
    dark: false,
  },
  "signature-apk-android": {
    label: "Android natif",
    short: "Keystore, keystore.properties, Kotlin DSL + Groovy, vérification apksigner.",
    logo: "/logos/android.svg",
    dark: true,
  },
  "signature-apk-flutter": {
    label: "Flutter",
    short: "key.properties, les deux DSL Gradle, flutter clean, build apk --release.",
    logo: "/logos/flutter.svg",
    dark: false,
  },
  "signature-apk-react-native": {
    label: "React Native",
    short: "gradle.properties MYAPP_UPLOAD_*, build.gradle, assembleRelease.",
    logo: "/logos/react.svg",
    dark: true,
  },
  "signature-apk-expo": {
    label: "Expo",
    short: "EAS remote ou credentials.json local, eas credentials, expo prebuild.",
    logo: "/logos/expo.svg",
    dark: true,
  },
  "signature-apk-capacitor": {
    label: "Capacitor",
    short: "keystore.properties, npx cap build, pourquoi pas jarsigner par défaut.",
    logo: "/logos/capacitor.svg",
    dark: false,
  },
  "signature-apk-depannage": {
    label: "Vérifier & dépanner",
    short: "apksigner verify, les refus de la plateforme, debug APK, keystore perdu.",
    logo: undefined,
    dark: false,
  },
} as const satisfies Record<
  SignatureApkGuideSlug,
  { label: string; short: string; logo?: string; dark: boolean }
>;

export const SIGNATURE_APK_GUIDE_SLUGS = Object.keys(
  SIGNATURE_APK_GUIDE_META,
) as SignatureApkGuideSlug[];

export type GuideDoc = {
  slug: string;
  markdown: string;
  headings: { id: string; text: string }[];
};

export async function getGuideDoc(slug: string): Promise<GuideDoc | null> {
  const file = GUIDE_FILES[slug];
  if (!file) return null;
  let markdown: string;
  try {
    markdown = await readFile(path.join(DIR, file), "utf8");
  } catch {
    return null;
  }
  const headings = markdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, "").trim())
    .filter(Boolean)
    .map((text) => ({ id: slugifyHeading(text), text }));
  return { slug, markdown, headings };
}
