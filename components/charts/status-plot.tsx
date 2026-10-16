import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS } from "./palette";

/**
 * Répartition par statut.
 *
 * **Barre empilée, pas un donut.** Comparer trois valeurs dans un donut est un
 * mauvais usage : l'œil compare des angles, pas des aires. La barre empilée les
 * compare sur une ligne de même longueur, ce qui est exact.
 *
 * L'ordre est fixe (publiées, en attente, rejetées) pour que la lecture ne
 * change pas quand un produit passe en ligne.
 *
 * La teinte est sémantique : vert = en ligne, ambre = en revue, rouge = rejetée.
 * Elle ne porte jamais seule — chaque pastille est doublée par son libellé et son
 * compte dans la légende, donc le panneau reste lisible sans la couleur.
 */

const ORDER = [
  { key: "live", label: "Publiées", color: STATUS.live },
  { key: "pending", label: "En attente", color: STATUS.pending },
  { key: "rejected", label: "Rejetées", color: STATUS.rejected },
] as const;

export type StatusCounts = {
  live: number;
  pending: number;
  rejected: number;
};

export function StatusPlot({ counts, className }: { counts: StatusCounts; className?: string }) {
  const total = ORDER.reduce((s, k) => s + counts[k.key], 0);

  if (total === 0) {
    return (
      <EmptyState
        illustration="none"
        size="sm"
        className={className}
        title="Aucune fiche pour l'instant."
        description="Publiez un produit et il apparaîtra ici avec son statut."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {ORDER.map((k) => {
          const value = counts[k.key];
          if (value === 0) return null;
          return (
            <span
              key={k.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(value / total) * 100}%`, backgroundColor: k.color }}
              title={`${k.label} : ${value}`}
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {ORDER.map((k) => (
          <li key={k.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: k.color }}
            />
            <span className="text-[13px] font-medium text-muted-foreground">{k.label}</span>
            <span className="text-[13px] font-black tabular-nums text-foreground">
              {counts[k.key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
