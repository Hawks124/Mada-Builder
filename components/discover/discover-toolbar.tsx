"use client";

import { SearchInput } from "@/components/ui/search-input";
import { SortAscendingIcon, CaretDownIcon, FadersIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFilters, type DiscoverSortId } from "./sidebar-filter";
import { buildDiscoverHref } from "@/lib/discover-filters";

// Sorts réels uniquement : comments (V1.5) et MRR reviendront avec leurs
// phases — jamais d'option qui trie sur du vent.
const SORT_OPTIONS: { id: DiscoverSortId; label: string }[] = [
  { id: "votes", label: "Les + Votés" },
  { id: "newest", label: "Les + Récents" },
];

export function DiscoverToolbar() {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const {
    filters,
    sortId,
    setSortId,
    query,
    setQuery,
    sidebarOpen,
    toggleSidebar,
    activeCount,
    navigate,
  } = useFilters();
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortId)?.label ?? "Trier";

  // Recherche → URL en debounce 500 ms (le serveur cherche ; frappe fluide,
  // pas de navigation par touche). Garde anti-navigation-fantôme : si le
  // href reconstruit égale l'URL courante (montage StrictMode, timer périmé
  // après un filtre), on skip — jamais de GET redondant ni de voile gratuit.
  const navState = useRef({ filters, sortId, query });
  useEffect(() => {
    navState.current = { filters, sortId, query };
  });
  useEffect(() => {
    const t = setTimeout(() => {
      const s = navState.current;
      const href = buildDiscoverHref(s.filters, 1, s.sortId, s.query);
      if (window.location.pathname + window.location.search !== href) {
        navigate(href);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [query, navigate]);

  // Échap ferme le dropdown de tri.
  useEffect(() => {
    if (!isSortOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSortOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSortOpen]);

  return (
    <div className="flex flex-row items-center gap-2 w-full">
      {/* Search — état contexte (URL debounced), cible prioritaire du Alt+K global */}
      <SearchInput
        variant="page"
        placeholder="Rechercher par nom, maker ou mot-clé..."
        data-search-primary="true"
        showKbd
        kbdLabel="Alt K"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-0"
      />

      {/* Sort trigger */}
      <div className="relative shrink-0">
        <button
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={cn(
            "flex items-center justify-center gap-0 sm:gap-2.5",
            "h-10 w-10 sm:w-auto sm:px-4 rounded-full",
            "bg-background border border-border/60 shadow-sm",
            "hover:bg-muted/40 transition-colors",
          )}
          aria-label="Trier les produits"
          aria-expanded={isSortOpen}
        >
          <SortAscendingIcon weight="bold" className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
          <span className="hidden sm:inline text-[13px] font-bold text-foreground whitespace-nowrap">
            {sortLabel}
          </span>
          <CaretDownIcon
            weight="bold"
            className="hidden sm:block w-3.5 h-3.5 text-muted-foreground"
          />
        </button>

        {isSortOpen && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setIsSortOpen(false)} />
            <div className="absolute top-[calc(100%+8px)] right-0 w-52 bg-background border border-border/50 shadow-2xl rounded-2xl p-2 flex flex-col z-80">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSortId(opt.id);
                    setIsSortOpen(false);
                  }}
                  className={cn(
                    "text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors",
                    sortId === opt.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Desktop: toggle sidebar (à droite, après le tri) — mobile: MobileFilterTrigger dans page.tsx */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-pressed={sidebarOpen}
        aria-label={sidebarOpen ? "Masquer les filtres" : "Afficher les filtres"}
        className={cn(
          "relative hidden lg:flex items-center justify-center gap-2",
          "h-10 w-10 xl:w-auto xl:px-4 rounded-full shrink-0",
          "border transition-all duration-300 cursor-pointer",
          sidebarOpen
            ? "bg-foreground text-background border-foreground shadow-sm"
            : "bg-background border-border/60 shadow-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        <FadersIcon weight="fill" className="w-4 h-4 shrink-0" />
        <span className="hidden xl:inline text-[13px] font-bold whitespace-nowrap">Filtres</span>
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}
