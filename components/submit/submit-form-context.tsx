"use client";

import * as React from "react";
import {
  MOCK_APPS,
  type DashboardApp,
} from "@/components/dashboard/dashboard-mock";
import { DEFAULT_LIFECYCLE_ID } from "@/config/lifecycle";

interface SubmitFormState {
  productType: string;
  audience: string;
  lifecycle: string;
  /** Produit en cours d'édition (?edit=id) — null en création. */
  editApp: DashboardApp | null;
  isEditing: boolean;
}

interface SubmitFormContextValue extends SubmitFormState {
  setProductType: (value: string) => void;
  setAudience: (value: string) => void;
  setLifecycle: (value: string) => void;
}

const SubmitFormContext =
  React.createContext<SubmitFormContextValue | null>(null);

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
  const [productType, setProductType] = React.useState(
    editApp?.productTypeId ?? "app_web",
  );
  const [audience, setAudience] = React.useState(
    editApp?.audienceId ?? "all",
  );
  const [lifecycle, setLifecycle] = React.useState<string>(
    editApp?.lifecycle ?? DEFAULT_LIFECYCLE_ID,
  );

  const value = React.useMemo(
    () => ({
      productType,
      audience,
      lifecycle,
      editApp,
      isEditing: editApp !== null,
      setProductType,
      setAudience,
      setLifecycle,
    }),
    [productType, audience, lifecycle, editApp],
  );

  return (
    <SubmitFormContext.Provider value={value}>
      {children}
    </SubmitFormContext.Provider>
  );
}

export function useSubmitForm(): SubmitFormContextValue {
  const ctx = React.useContext(SubmitFormContext);
  if (!ctx) {
    throw new Error("useSubmitForm must be used inside <SubmitFormProvider>");
  }
  return ctx;
}
