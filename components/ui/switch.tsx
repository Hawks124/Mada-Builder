"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Switch partagé — interrupteur binaire accessible (`role="switch"`,
 * `aria-checked`, clavier natif via `<button>`), 100 % contrôlé.
 * Le parent possède l'état (optimiste + revert si erreur) ; ce composant
 * ne fait que l'affichage + l'activation. Tailles : md (settings),
 * sm (lignes denses).
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  size = "md",
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  /** Libellé accessible (lu par les lecteurs d'écran). */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const dims = size === "md" ? "h-7 w-12" : "h-5 w-9";
  const knob = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const offset = size === "md" ? "translate-x-5" : "translate-x-4";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50",
        dims,
        checked ? "bg-foreground justify-start" : "bg-muted justify-start",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full bg-background shadow transition-transform duration-200",
          knob,
          size === "md" ? "ml-1" : "ml-0.5",
          checked && offset,
        )}
      />
    </button>
  );
}
