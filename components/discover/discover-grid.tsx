"use client";

import { useFilters } from "./sidebar-filter";
import { DiscoverRowCard } from "./discover-row-card";
import { Pagination } from "@/components/ui/pagination";
import { ListLoadingOverlay } from "@/components/ui/list-loading-overlay";
import { EmptyState } from "@/components/ui/empty-state";
import { buildDiscoverHref, DISCOVER_PAGE_SIZE } from "@/lib/discover-filters";
import type { DiscoverItem } from "@/services/discover.service";

/**
 * Grille résultats — présentation pure, données via props (la page
 * serveur charge). Pagination par numéros (offset volume V1) ; hrefs
 * complets (filtres + tri + recherche conservés).
 */
export function DiscoverGrid({
  items,
  total,
  page,
  searchQuery,
  votedIds = [],
}: {
  items: DiscoverItem[];
  total: number;
  page: number;
  searchQuery: string;
  votedIds?: string[];
}) {
  const { filters, reset, activeCount, sortId, isNavigating } = useFilters();
  const q = searchQuery.trim();
  const totalPages = Math.max(1, Math.ceil(total / DISCOVER_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const firstRank = (safePage - 1) * DISCOVER_PAGE_SIZE + 1;

  return (
    <div className="relative flex flex-col gap-10">
      <ListLoadingOverlay active={isNavigating} />
      {/* Compteur de résultats — indispensable sur un annuaire (confiance). */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-bold tabular-nums" aria-live="polite">
          <span className="text-foreground">{total}</span>{" "}
          <span className="text-muted-foreground font-medium">
            {total === 1 ? "produit" : "produits"}
          </span>
          {q !== "" && <span className="text-muted-foreground font-medium"> pour « {q} »</span>}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-[13px] font-bold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {items.map((product, i) => (
              <DiscoverRowCard
                key={product.id}
                product={product}
                rank={firstRank + i}
                voted={votedIds.includes(product.id)}
              />
            ))}
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={(p) => buildDiscoverHref(filters, p, sortId, searchQuery)}
            className="mt-0 pb-0"
          />
        </>
      ) : (
        /* Empty state global : jamais un cul-de-sac. */
        <EmptyState
          title={q !== "" ? `Aucun résultat pour « ${q} »` : "Aucun produit trouvé"}
          description={
            activeCount > 0
              ? "Aucune combinaison de filtres ne renvoie de produit. Essayez d'en retirer un."
              : "Rien à afficher pour le moment — revenez après les prochains votes."
          }
          action={
            activeCount > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-bold hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
