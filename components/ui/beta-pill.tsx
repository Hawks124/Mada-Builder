import { cn } from "@/lib/utils";

/**
 * Pastille « Bêta » — pour une **fonctionnalité** en cours d'expérimentation.
 *
 * Ne pas confondre avec `LifecyclePill` : là, `beta` décrit l'avancement d'un
 * **produit maker**. Ici c'est le tableau de bord qui n'est pas encore stabilisé.
 */
export function BetaPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 px-2 py-0.5",
        "text-[10px] font-black uppercase tracking-[0.12em]",
        "text-muted-foreground/80",
        className,
      )}
    >
      Bêta
    </span>
  );
}
