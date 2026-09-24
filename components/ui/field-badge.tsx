import { cn } from "@/lib/utils";

type FieldBadgeVariant = "required" | "optional";

const VARIANT_CLASSES: Record<FieldBadgeVariant, string> = {
  required: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  optional: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function FieldBadge({ variant }: { variant: FieldBadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
        VARIANT_CLASSES[variant],
      )}
    >
      {variant === "required" && (
        <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
      )}
      {variant === "required" ? "Requis" : "Optionnel"}
    </span>
  );
}
