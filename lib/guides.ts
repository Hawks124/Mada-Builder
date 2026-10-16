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
};

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
