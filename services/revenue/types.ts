/**
 * Types partagés revenus vérifiés (Phase 2 MRR). Contrat unique des 5
 * adaptateurs : `{ mrrCents, currency, subscriberCount }` — montants
 * validés (entiers ≥ 0, devise ISO), jamais de PII.
 */
import type { RevenueProviderId } from "@/db/schema";

export type { RevenueProviderId };

export type RevenueResult = {
  /** MRR en centimes de `currency` (natif provider, jamais converti). */
  mrrCents: number;
  /** ISO 4217 (ex. USD, EUR). */
  currency: string;
  /** Abonnés actifs comptés (même périmètre que le MRR). */
  subscriberCount: number;
};

export type RevenueDisplayMode = "full" | "badge_only";
export type RevenueStatus = "active" | "failing" | "revoked";

/** Champs non-secrets exigés par provider (config JSON validée Zod). */
export type RevenueConfigSpec = {
  id: RevenueProviderId;
  label: string;
  logo: string;
  /** Slug fiche guide (`/guides/revenus-verifies/<slug>`). */
  guideSlug: string;
  /** Champs à demander en plus de la clé (ex. project_id). */
  extraFields: { key: string; label: string; placeholder: string; hint: string }[];
  /** Refus explicite des clés sur-permissionnées (ex. sk_ Stripe). */
  keyFormat: { prefix: string[]; example: string; rejectMessage: string | null };
  /** Lien doc officielle (guide maker). */
  docsUrl: string;
};

export const REVENUE_CONFIG_SPECS: Record<RevenueProviderId, RevenueConfigSpec> = {
  stripe: {
    id: "stripe",
    label: "Stripe",
    logo: "/logos/stripe.svg",
    guideSlug: "stripe",
    extraFields: [],
    keyFormat: {
      prefix: ["rk_live_", "rk_test_"],
      example: "rk_live_…",
      rejectMessage: "Clé secrète (sk_) refusée : créez une clé restreinte (rk_) en lecture seule.",
    },
    docsUrl: "https://docs.stripe.com/keys/restricted-api-keys",
  },
  revenuecat: {
    id: "revenuecat",
    label: "RevenueCat",
    logo: "/logos/revenuecat.svg",
    guideSlug: "revenuecat",
    extraFields: [
      {
        key: "projectId",
        label: "ID du projet",
        placeholder: "ex : abc123…",
        hint: "Réglages projet → Clés API (nécessaire aux métriques v2).",
      },
    ],
    keyFormat: { prefix: [], example: "Clé secrète v2", rejectMessage: null },
    docsUrl: "https://www.revenuecat.com/docs/api-v2/overview",
  },
  paddle: {
    id: "paddle",
    label: "Paddle",
    logo: "/logos/paddle.svg",
    guideSlug: "paddle",
    extraFields: [],
    keyFormat: {
      prefix: ["pdl_live_", "pdl_sdbx_"],
      example: "pdl_live_apikey_…",
      rejectMessage: null,
    },
    docsUrl: "https://developer.paddle.com/api-reference/about/authentication",
  },
  polar: {
    id: "polar",
    label: "Polar",
    logo: "/logos/polar.svg",
    guideSlug: "polar",
    extraFields: [],
    keyFormat: {
      prefix: ["polar_oat_"],
      example: "polar_oat_…",
      rejectMessage: null,
    },
    docsUrl: "https://polar.sh/docs/api-reference/introduction",
  },
  lemon_squeezy: {
    id: "lemon_squeezy",
    label: "Lemon Squeezy",
    logo: "/logos/lemon-squeezy.svg",
    guideSlug: "lemon-squeezy",
    extraFields: [
      {
        key: "storeId",
        label: "ID de la boutique",
        placeholder: "ex : 12345",
        hint: "Visible dans le dashboard / l'API (nécessaire au filtre).",
      },
    ],
    keyFormat: { prefix: [], example: "Clé API (live)", rejectMessage: null },
    docsUrl: "https://docs.lemonsqueezy.com/api/getting-started/requests",
  },
};

export const REVENUE_PROVIDER_IDS = Object.keys(REVENUE_CONFIG_SPECS) as RevenueProviderId[];

/**
 * Providers dont le logo (sombre) exige inversion en thème sombre —
 * même liste que les `darkClass` de l'api-shell (une seule source).
 */
export const REVENUE_LOGO_DARK_INVERT: RevenueProviderId[] = ["stripe", "paddle", "lemon_squeezy"];

/** Garde format de clé (pré-validation, avant tout appel réseau). */
export function checkKeyFormat(provider: RevenueProviderId, key: string): string | null {
  const spec = REVENUE_CONFIG_SPECS[provider];
  const t = key.trim();
  if (t === "") return "Clé requise.";
  if (spec.keyFormat.prefix.length > 0 && !spec.keyFormat.prefix.some((p) => t.startsWith(p))) {
    return (
      spec.keyFormat.rejectMessage ?? `Format inattendu (attendu : ${spec.keyFormat.example}).`
    );
  }
  return null;
}
