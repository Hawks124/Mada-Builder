"use client";

import * as React from "react";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import { DEFAULT_LIFECYCLE_ID } from "@/config/lifecycle";
import { PRICING_MODELS } from "@/config/pricing";
import type { UrlPolicy } from "@/lib/url-verdict";

interface SubmitFormState {
  productType: string;
  audience: string;
  lifecycle: string;
  /** Produit en cours d'édition (?edit=id) — null en création. */
  editApp: DashboardApp | null;
  isEditing: boolean;
  /** Pricing (remonté de metadata — règle privacy si monétisé). */
  pricing: string;
  /** Valeurs des champs liens (pastilles + règle point d'accès). */
  linkValues: Record<string, string>;
  /** Politiques constatées par champ (warn = flag revue admin). */
  linkPolicies: Record<string, UrlPolicy>;
  /** Erreurs inline par champ (clé = name de l'input, ex. "tagline"). */
  errors: Record<string, string>;
  /** Résumé médias (validation publish : logo + ≥1 capture). */
  mediaSummary: { hasLogo: boolean; shotCount: number };
  /** Brouillon local (création) — null en édition ou si vide. */
  draft: Record<string, string> | null;
  /** Médias existants (édition) — affichage seul, absents = conservés. */
  existingMedia: {
    iconUrl: string | null;
    shots: { url: string; width: number | null; height: number | null }[];
  } | null;
}

interface SubmitFormContextValue extends SubmitFormState {
  setProductType: (value: string) => void;
  setAudience: (value: string) => void;
  setLifecycle: (value: string) => void;
  setPricing: (value: string) => void;
  setLinkValue: (id: string, value: string) => void;
  setLinkPolicy: (id: string, policy: UrlPolicy | null) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearError: (key: string) => void;
  setMediaSummary: (summary: { hasLogo: boolean; shotCount: number }) => void;
}

const SubmitFormContext = React.createContext<SubmitFormContextValue | null>(null);

/** Clés formulaire qui ne sont PAS des liens (reste du brouillon = liens). */
const LINK_FORM_KEYS = new Set([
  "name",
  "tagline",
  "description",
  "productType",
  "lifecycle",
  "audience",
  "category",
  "categories",
  "tags",
  "platforms",
  "pricing",
  "license",
  "installCommand",
  "version",
  "requirements",
  "changelogUrl",
  "hasAds",
  "hasThirdParty",
  "targetCountries",
  "languages",
  "galleryOrientation",
  "logo",
  "screenshots",
]);

/** Parse une liste JSON du brouillon (tolérant : ordure → []). */
export function draftJsonList(draft: Record<string, string> | null, key: string): string[] {
  const raw = draft?.[key];
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Fiche à éditer — chargée serveur (?edit=id, auteur vérifié), jamais de mock. */
export function SubmitFormProvider({
  editApp,
  initialDraft,
  existingMedia,
  children,
}: {
  editApp: DashboardApp | null;
  /** Brouillon local (création) — pré-remplit chaque état au 1er render. */
  initialDraft?: Record<string, string> | null;
  /** Médias existants (édition) — affichage seul. */
  existingMedia?: {
    iconUrl: string | null;
    shots: { url: string; width: number | null; height: number | null }[];
  } | null;
  children: React.ReactNode;
}) {
  const draft = editApp ? null : (initialDraft ?? null);
  // Defaults mirror the section-local defaults, sauf en édition où
  // les valeurs existantes pré-remplissent le formulaire.
  const [productType, setProductType] = React.useState(
    editApp?.productTypeId ?? draft?.productType ?? "app_web",
  );
  const [audience, setAudience] = React.useState(editApp?.audienceId ?? draft?.audience ?? "all");
  const [lifecycle, setLifecycle] = React.useState<string>(
    editApp?.lifecycle ?? draft?.lifecycle ?? DEFAULT_LIFECYCLE_ID,
  );
  const [pricing, setPricing] = React.useState<string>(
    PRICING_MODELS.find((o) => o.label === editApp?.pricing)?.id ?? draft?.pricing ?? "free",
  );
  const [linkValues, setLinkValues] = React.useState<Record<string, string>>(() => {
    if (editApp?.linkValues) return editApp.linkValues;
    if (!draft) return {};
    const links: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (typeof v === "string" && v !== "" && !LINK_FORM_KEYS.has(k)) links[k] = v;
    }
    return links;
  });
  const [linkPolicies, setLinkPolicies] = React.useState<Record<string, UrlPolicy>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [mediaSummary, setMediaSummary] = React.useState({ hasLogo: false, shotCount: 0 });

  const setLinkValue = React.useCallback((id: string, value: string) => {
    setLinkValues((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }));
  }, []);

  const setLinkPolicy = React.useCallback((id: string, policy: UrlPolicy | null) => {
    setLinkPolicies((prev) => {
      if (policy === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev[id] === policy ? prev : { ...prev, [id]: policy };
    });
  }, []);

  const clearError = React.useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      productType,
      audience,
      lifecycle,
      editApp,
      isEditing: editApp !== null,
      pricing,
      linkValues,
      linkPolicies,
      errors,
      mediaSummary,
      draft,
      existingMedia: existingMedia ?? null,
      setProductType,
      setAudience,
      setLifecycle,
      setPricing,
      setLinkValue,
      setLinkPolicy,
      setErrors,
      clearError,
      setMediaSummary,
    }),
    [
      productType,
      audience,
      lifecycle,
      editApp,
      pricing,
      linkValues,
      linkPolicies,
      errors,
      mediaSummary,
      draft,
      existingMedia,
      setLinkPolicy,
      setLinkValue,
      clearError,
    ],
  );

  return <SubmitFormContext.Provider value={value}>{children}</SubmitFormContext.Provider>;
}

export function useSubmitForm(): SubmitFormContextValue {
  const ctx = React.useContext(SubmitFormContext);
  if (!ctx) {
    throw new Error("useSubmitForm must be used inside <SubmitFormProvider>");
  }
  return ctx;
}

/** Accès tolérant (composants partagés hors formulaire, ex. InputField). */
export function useOptionalSubmitForm(): SubmitFormContextValue | null {
  return React.useContext(SubmitFormContext);
}
