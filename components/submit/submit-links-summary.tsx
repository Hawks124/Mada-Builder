"use client";

import { PRODUCT_LINK_FIELDS, hasAccessPoint } from "@/config/product-links";
import { useSubmitForm } from "@/components/submit/submit-form-context";

/**
 * Résumé pré-submit des liens — nudge, jamais blocage (sauf erreur dure
 * traitée champ par champ) : N liens non vérifiés = revue plus lente.
 * Lit le contexte (valeurs + politiques constatées par les pastilles).
 */
export function SubmitLinksSummary() {
  const { linkValues, linkPolicies } = useSubmitForm();

  const filled = Object.entries(linkValues).filter(([, v]) => v.trim() !== "");
  if (filled.length === 0) return null;

  const warned = filled.filter(([id]) => linkPolicies[id] === "warn");
  const blocked = filled.filter(([id]) => linkPolicies[id] === "block");
  const pending = filled.filter(([id]) => linkPolicies[id] === undefined);
  if (warned.length === 0 && blocked.length === 0 && pending.length === 0) return null;

  const names = (ids: string[]) =>
    ids
      .map((id) => PRODUCT_LINK_FIELDS[id]?.label ?? id)
      .slice(0, 3)
      .join(", ") + (ids.length > 3 ? ` (+${ids.length - 3})` : "");

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border/40 bg-muted/20 px-5 py-4">
      {blocked.length > 0 && (
        <p className="text-[13px] font-bold text-red-600 dark:text-red-400">
          {blocked.length} lien{blocked.length > 1 ? "s" : ""} à corriger avant envoi :{" "}
          {names(blocked.map(([id]) => id))}.
        </p>
      )}
      {warned.length > 0 && (
        <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">
          {warned.length} lien{warned.length > 1 ? "s" : ""} non vérifié
          {warned.length > 1 ? "s" : ""} ({names(warned.map(([id]) => id))}) — soumission possible,
          revue plus lente.
        </p>
      )}
      {pending.length > 0 && blocked.length === 0 && warned.length === 0 && (
        <p className="text-[13px] font-medium text-muted-foreground">
          Vérification des liens en cours…
        </p>
      )}
      {!hasAccessPoint(linkValues) && (
        <p className="text-[13px] font-bold text-foreground">
          Il manque un point d&apos;accès (site, store, registre ou démo).
        </p>
      )}
    </div>
  );
}
