"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";
import { Spinner } from "@/components/ui/spinner";
import { useOptionalSubmitForm } from "@/components/submit/submit-form-context";
import { useUrlCheck } from "@/components/submit/use-url-check";

/**
 * Journal des modifications — même vérification inline que les liens
 * (pastille ok/warn/block), sans passer par le store linkValues (fusionné
 * dans links.changelog côté serveur). Vide = idle, jamais de bruit.
 */
export function ChangelogField({ defaultValue }: { defaultValue?: string }) {
  const submitCtx = useOptionalSubmitForm();
  const error = submitCtx?.errors["changelogUrl"];
  const [value, setValue] = React.useState(defaultValue ?? "");
  const check = useUrlCheck(value);
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="changelogUrl"
        className="text-[14px] font-bold text-foreground flex items-center gap-2"
      >
        Journal des modifications
        <FieldBadge variant="optional" />
      </label>
      <div
        className={cn(
          "relative rounded-2xl bg-background border overflow-hidden focus-within:border-foreground/40 hover:border-foreground/20 transition-colors w-full",
          error || check.status === "block" ? "border-red-500/60" : "border-border/60",
          check.status === "ok" && "border-emerald-500/40",
        )}
      >
        <input
          id="changelogUrl"
          name="changelogUrl"
          type="url"
          placeholder="https://…/CHANGELOG"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            submitCtx?.clearError("changelogUrl");
          }}
          aria-invalid={error || check.status === "block" ? true : undefined}
          className="w-full bg-transparent border-none px-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none"
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 dark:text-red-400"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
          {error}
        </p>
      ) : check.status === "block" ? (
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 dark:text-red-400 motion-safe:animate-field-pop">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
          {check.message} — la revue tranchera.
        </p>
      ) : (
        check.status !== "idle" && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-medium motion-safe:animate-field-pop",
              check.status === "checking" && "text-muted-foreground",
              check.status === "ok" && "text-emerald-600 dark:text-emerald-400",
              check.status === "warn" && "text-amber-600 dark:text-amber-400",
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
      {error == null && check.status === "idle" && (
        <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Lien vers vos notes de version.
        </span>
      )}
    </div>
  );
}
