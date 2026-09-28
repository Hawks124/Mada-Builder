import { cn } from "@/lib/utils";

type FieldBadgeVariant = "required" | "recommended" | "optional";

const VARIANT_CLASSES: Record<FieldBadgeVariant, string> = {
  required: " bg-red-500/10 text-red-600 dark:text-red-400",
  recommended: " bg-amber-500/10 text-amber-600 dark:text-amber-400",
  optional: " bg-muted/40 text-muted-foreground",
};

const VARIANT_LABELS: Record<FieldBadgeVariant, string> = {
  required: "Requis",
  recommended: "Recommandé",
  optional: "Optionnel",
};

export function FieldBadge({ variant }: { variant: FieldBadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
        VARIANT_CLASSES[variant],
      )}
    >
      {variant === "required" && (
        <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
      )}
      {VARIANT_LABELS[variant]}
    </span>
  );
}
