import { EmptyState } from "@/components/ui/empty-state";
import type { FeaturedHistoryRow } from "@/services/ranking.service";

/**
 * Historique journalier — lecture seule.
 *
 * `getFeatured` insère la ligne du jour même si le cron n'a pas tourné : la
 * table est un journal complet, pas la seule liste des épinglages. D'où la
 * distinction « par vous » / « automatique ».
 */
export function FeaturedHistory({ rows }: { rows: FeaturedHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        illustration="none"
        size="sm"
        title="Aucun produit mis en avant."
        description="L'historique démarre à la première rotation."
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const date = new Date(`${row.featuredOn}T00:00:00Z`).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
        return (
          <li
            key={row.featuredOn}
            className="flex items-baseline gap-4 border-t border-border/40 py-3"
          >
            <span className="w-[104px] shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
              {date}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
              <a href={`/products/${row.slug}`} className="hover:underline">
                {row.name}
              </a>
            </span>
            <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/70">
              {row.pinned ? "Par vous" : "Automatique"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
