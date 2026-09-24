import { CircleNotchIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md";

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

/**
 * Indicateur de chargement partagé — TOUT déclencheur de mutation en
 * affiche un (boutons, dialogs). Indéterminé par design : le % réel
 * n'existe pas en Server Action (voir docs/auth.md §8).
 * `motion-safe` : aucun spin si l'utilisateur préfère le réduire.
 */
export function Spinner({
  size = "sm",
  className,
  label = "Chargement…",
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex shrink-0", className)}>
      <CircleNotchIcon
        weight="bold"
        aria-hidden="true"
        className={cn(SIZE_CLASS[size], "motion-safe:animate-spin")}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
