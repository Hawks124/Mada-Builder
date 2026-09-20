import { cn } from "@/lib/utils";

type AgeBadgeSize = "xs" | "sm" | "md";

const SIZE_CLASSES: Record<AgeBadgeSize, string> = {
  // Meta-line compacte (newest cards)
  xs: "h-4 px-1 border border-foreground/30 rounded-[3px] text-[8px] text-muted-foreground",
  // Ligne meta sidebar
  sm: "w-7 h-5 border border-foreground/40 rounded-sm text-[10px] text-foreground bg-background",
  // Bloc classification featured (+ label à côté)
  md: "w-6 h-6 border-[1.5px] border-foreground rounded-sm text-[11px] text-foreground",
};

export function AgeBadge({
  value,
  size = "sm",
  className,
}: {
  value: string;
  size?: AgeBadgeSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 font-black leading-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {value}
    </span>
  );
}
