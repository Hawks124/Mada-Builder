import { TagIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

// Tag pill — pattern unique (fiche détail + rows maker publiques).
// Jamais de "#" brut : toujours la pill avec icône.
export function TagPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap",
        className,
      )}
    >
      <TagIcon weight="fill" className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
