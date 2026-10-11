import { ProductAvatarTile } from "@/components/ui/product-avatar";
import { cn } from "@/lib/utils";
import type { ChartProduct } from "@/components/dashboard/dashboard-charts-mock";

/**
 * Comparaison par produit.
 *
 * **Construit en HTML, pas en Recharts.** La règle du dépôt : Recharts quand
 * l'axe est continu (courbe, tunnel), HTML quand ce sont des lignes avec des
 * images. Un tick Recharts est du SVG et ne peut pas héberger `ProductAvatar`
 * — il aurait fallu un `<image>` sans repli sur les initiales.
 *
 * **Trois échelles indépendantes.** Les vues cent fois plus nombreuses que les
 * votes rendraient ces derniers invisibles sur une échelle commune ; chaque
 * barre se lit donc dans sa propre colonne, ce qui garde l'information utile :
 * « quel produit gagne sur CE critère ».
 *
 * **La teinte ne porte rien dans ce tableau.** La colonne s'appelle « Vues »,
 * « Clics » ou « Votes » : une couleur par colonne répéterait l'en-tête sans rien
 * ajouter. Seul le maximum se distingue, par la saturation du trait et par le
 * rang écrit — la couleur ne le porte jamais seule (WCAG 1.4.1).
 */

const METRICS = [
  { key: "views", label: "Vues", bar: "bg-foreground" },
  { key: "clicks", label: "Clics", bar: "bg-foreground/55" },
  { key: "votes", label: "Votes", bar: "bg-foreground/30" },
] as const;

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} k`;
  return String(n);
}

export function ProductsPlot({
  products,
  className,
}: {
  products: ChartProduct[];
  className?: string;
}) {
  const sorted = [...products].sort((a, b) => b.views - a.views);

  const max = {
    views: Math.max(...sorted.map((p) => p.views), 1),
    clicks: Math.max(...sorted.map((p) => p.clicks), 1),
    votes: Math.max(...sorted.map((p) => p.votes), 1),
  };

  // Le rang n°1 ne part qu'au **maximum unique** : deux produits à égalité
  // seraient tous deux « n°1 », ce qui est faux. En cas d'égalité, personne
  // n'est distingué.
  const leaders = new Set<string>();
  for (const m of METRICS) {
    const top = Math.max(...sorted.map((p) => p[m.key]));
    const holders = sorted.filter((p) => p[m.key] === top);
    if (top > 0 && holders.length === 1) leaders.add(`${holders[0]!.name}:${m.key}`);
  }

  if (sorted.length === 0) {
    return (
      <p className={cn("text-[14px] font-medium text-muted-foreground", className)}>
        Aucun produit publié à comparer.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* En-têtes de colonnes, alignés sur la grille des lignes. */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-end gap-x-8 pb-3">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">
          Produit
        </span>
        <ul className="grid grid-cols-3 gap-x-4">
          {METRICS.map((m) => (
            <li
              key={m.key}
              className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/60"
            >
              {m.label}
            </li>
          ))}
        </ul>
      </div>

      <ul className="flex flex-col">
        {sorted.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-x-8 border-t border-border/40 py-4"
          >
            <span className="flex min-w-0 items-center gap-3">
              <ProductAvatarTile
                iconUrl={row.iconUrl}
                initials={row.initials}
                gradient={row.gradient}
                size={40}
              />
              <span className="truncate text-[15px] font-bold text-foreground" title={row.name}>
                {row.name}
              </span>
            </span>

            <ul className="grid grid-cols-3 gap-x-4">
              {METRICS.map((m) => {
                const value = row[m.key];
                const isBest = leaders.has(`${row.name}:${m.key}`);
                return (
                  <li key={m.key} className="flex flex-col gap-1.5">
                    <span className="flex items-baseline gap-1.5">
                      <span className="whitespace-nowrap text-[13px] font-black tabular-nums text-foreground">
                        {compact(value)}
                      </span>
                      {isBest && (
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-foreground">
                          n°1
                        </span>
                      )}
                    </span>
                    <span className="h-[13px] w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-[width] duration-500",
                          isBest ? "bg-foreground" : m.bar,
                        )}
                        style={{ width: `${(value / max[m.key]) * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
