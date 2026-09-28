"use client";

import { useFilters } from "./sidebar-filter";
import { DiscoverRowCard } from "./discover-row-card";
import { Pagination } from "@/components/ui/pagination";
import {
  filterCatalog,
  getCatalog,
  sortCatalog,
  type CatalogProduct,
} from "@/services/catalog-mock.service";
import { buildDiscoverHref } from "@/lib/discover-filters";

const PAGE_SIZE = 12;

export function DiscoverGrid({ searchQuery, page }: { searchQuery: string; page: number }) {
  const { filters, reset, activeCount, sortId } = useFilters();

  const q = searchQuery.trim();
  const filtered = filterCatalog(getCatalog(), filters, q);
  const sorted = sortCatalog(filtered, sortId);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const items = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstRank = (safePage - 1) * PAGE_SIZE + 1;

  return (
    <div className="flex flex-col gap-10">
      {/* Compteur de résultats — indispensable sur un annuaire (confiance). */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-bold tabular-nums" aria-live="polite">
          <span className="text-foreground">{sorted.length}</span>{" "}
          <span className="text-muted-foreground font-medium">
            {sorted.length === 1 ? "produit" : "produits"}
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
              <DiscoverRowCard key={product.id} product={product} rank={firstRank + i} />
            ))}
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={(p) => buildDiscoverHref(filters, p)}
            className="mt-0 pb-0"
          />
        </>
      ) : (
        /* Empty state actionnable : jamais un cul-de-sac (DESIGN.md §15). */
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl">🌱</span>
          </div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            {q !== "" ? `Aucun résultat pour « ${q} »` : "Aucun produit trouvé"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {activeCount > 0
              ? "Aucune combinaison de filtres ne renvoie de produit. Essayez d'en retirer un."
              : "Rien à afficher pour le moment — revenez après les prochains votes."}
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-bold hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export type { CatalogProduct };
