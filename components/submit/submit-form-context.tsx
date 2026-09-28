"use client";

import * as React from "react";
import { MOCK_APPS, type DashboardApp } from "@/components/dashboard/dashboard-mock";
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
}

interface SubmitFormContextValue extends SubmitFormState {
  setProductType: (value: string) => void;
  setAudience: (value: string) => void;
  setLifecycle: (value: string) => void;
  setPricing: (value: string) => void;
  setLinkValue: (id: string, value: string) => void;
  setLinkPolicy: (id: string, policy: UrlPolicy | null) => void;
}

const SubmitFormContext = React.createContext<SubmitFormContextValue | null>(null);

/** Lookup mock — remplacé par getProductById au backend. */
function findEditApp(editId: string | null): DashboardApp | null {
  if (!editId) return null;
  return MOCK_APPS.find((a) => a.id === editId) ?? null;
}

export function SubmitFormProvider({
  editId,
  children,
}: {
  editId: string | null;
  children: React.ReactNode;
}) {
  const editApp = React.useMemo(() => findEditApp(editId), [editId]);

  // Defaults mirror the section-local defaults, sauf en édition où
  // les valeurs existantes pré-remplissent le formulaire.
  const [productType, setProductType] = React.useState(editApp?.productTypeId ?? "app_web");
  const [audience, setAudience] = React.useState(editApp?.audienceId ?? "all");
  const [lifecycle, setLifecycle] = React.useState<string>(
    editApp?.lifecycle ?? DEFAULT_LIFECYCLE_ID,
  );
  const [pricing, setPricing] = React.useState<string>(
    PRICING_MODELS.find((o) => o.label === editApp?.pricing)?.id ?? "free",
  );
  const [linkValues, setLinkValues] = React.useState<Record<string, string>>({});
  const [linkPolicies, setLinkPolicies] = React.useState<Record<string, UrlPolicy>>({});

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
      setProductType,
      setAudience,
      setLifecycle,
      setPricing,
      setLinkValue,
      setLinkPolicy,
    }),
    [
      productType,
      audience,
      lifecycle,
      editApp,
      pricing,
      linkValues,
      linkPolicies,
      setLinkPolicy,
      setLinkValue,
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
