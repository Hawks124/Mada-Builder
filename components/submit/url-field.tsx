"use client";

import * as React from "react";
import { StoreLogo } from "@/components/ui/store-logo";
import { FieldBadge } from "@/components/ui/field-badge";
import { Spinner } from "@/components/ui/spinner";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import { useUrlCheck } from "@/components/submit/use-url-check";
import { matchStorePattern } from "@/lib/url-verdict";
import { cn } from "@/lib/utils";
import type { LinkFieldDef } from "@/config/product-links";

/**
 * Champ lien contrôlé : icône store, pastille de vérification à la volée
 * (debounce serveur), badge requis/recommandé/optionnel. Valeur remontée
 * au contexte (règle point d'accès + résumé pré-submit) ; statut remonté
 * aussi (flag revue admin). Le serveur re-vérifie TOUJOURS au submit.
 */
export function UrlField({
  field,
  badge,
}: {
  field: LinkFieldDef;
  badge: "required" | "recommended" | "optional";
}) {
  const { linkValues, setLinkValue, setLinkPolicy } = useSubmitForm();
  const [value, setValue] = React.useState(linkValues[field.id] ?? "");
  // Forme store immédiate (sans réseau) quand le champ est non vide.
  const shapeError =
    value.trim() !== "" && field.storePattern && !matchStorePattern(value, field.storePattern)
      ? "Pas une URL valide pour ce store (vérifiez l'identifiant)."
      : null;
  const check = useUrlCheck(value, { disabled: shapeError !== null });

  React.useEffect(() => {
    setLinkValue(field.id, value);
  }, [field.id, value, setLinkValue]);

  React.useEffect(() => {
    if (value.trim() === "") {
      setLinkPolicy(field.id, null);
    } else if (shapeError !== null) {
      setLinkPolicy(field.id, "block");
    } else if (check.status === "ok") setLinkPolicy(field.id, "ok");
    else if (check.status === "warn") setLinkPolicy(field.id, "warn");
    else if (check.status === "block") setLinkPolicy(field.id, "block");
  }, [field.id, value, check.status, shapeError, setLinkPolicy]);

  return (
    <div className="flex flex-col gap-2 relative">
      <label
        htmlFor={`link-${field.id}`}
        className="text-[13px] font-bold text-foreground flex items-center gap-2"
      >
        {field.label}
        <FieldBadge variant={badge} />
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <StoreLogo icon={field.icon} className="w-5 h-5" />
        </div>
        <input
          id={`link-${field.id}`}
          name={field.id}
          type="url"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
        />
      </div>
      {field.hint && value.trim() === "" && (
        <p className="text-[12px] font-medium text-muted-foreground/70">{field.hint}</p>
      )}
      {shapeError !== null ? (
        <p
          key="shape-error"
          className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 dark:text-red-400 motion-safe:animate-field-pop"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
          {shapeError}
        </p>
      ) : (
        check.status !== "idle" && (
          <p
            key={check.status + ("message" in check ? check.message : "")}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-medium motion-safe:animate-field-pop",
              check.status === "checking" && "text-muted-foreground",
              check.status === "ok" && "text-emerald-600 dark:text-emerald-400",
              check.status === "warn" && "text-amber-600 dark:text-amber-400",
              check.status === "block" && "text-red-600 dark:text-red-400",
            )}
          >
            {check.status === "checking" ? (
              <Spinner size="xs" />
            ) : (
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
            )}
            {check.status === "checking" ? "Vérification…" : check.message}
          </p>
        )
      )}
    </div>
  );
}
