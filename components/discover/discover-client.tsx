"use client";

import { DiscoverToolbar } from "@/components/discover/discover-toolbar";
import { DiscoverGrid } from "@/components/discover/discover-grid";
import { GridBackground } from "@/components/ui/grid-background";
import {
  FilterProvider,
  SidebarFilter,
  MobileFilterTrigger,
  useFilters,
} from "@/components/discover/sidebar-filter";
import { cn } from "@/lib/utils";
import type { DiscoverFilterState } from "@/lib/discover-filters";
import type { DiscoverSortId } from "@/components/discover/sidebar-filter";
import type { DiscoverItem } from "@/services/discover.service";
import { useEffect } from "react";

function DiscoverLayout({
  items,
  total,
  page,
  searchQuery,
  votedIds,
}: {
  items: DiscoverItem[];
  total: number;
  page: number;
  searchQuery: string;
  votedIds: string[];
}) {
  const { sidebarOpen, toggleSidebar } = useFilters();

  // Raccourci "f" : toggle sidebar (desktop). "Alt+K" global (navbar) gère
  // le focus search. Garde : jamais en cours de frappe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el != null && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.metaKey || e.ctrlKey || e.altKey || typing) return;
      if (e.key === "f" || e.key === "F") {
        if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  return (
    <div className="w-full flex-1 flex">
      {/* Desktop Sidebar — toggle via toolbar (ou "f"), smooth animation */}
      <aside
        className={cn(
          "hidden lg:block flex-shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
          sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="w-80">
          <SidebarFilter />
        </div>
      </aside>

      {/* Main Grid Area */}
      <main
        className={cn(
          "w-full flex-1 min-w-0 transition-[width] duration-300 ease-in-out",
          sidebarOpen ? "lg:w-[calc(100%-20rem)]" : "lg:w-full",
        )}
      >
        <div className="container px-4 md:px-8 max-w-7xl mx-auto py-10">
          <DiscoverGrid
            items={items}
            total={total}
            page={page}
            searchQuery={searchQuery}
            votedIds={votedIds}
          />
        </div>
      </main>
    </div>
  );
}

/**
 * Client island — filtres/tri/recherche seedés par l'URL via le serveur
 * (props), items chargés serveur. La sidebar navigue (pas d'état dupliqué).
 */
export function DiscoverClient({
  initialFilters,
  initialSortId,
  initialQuery,
  initialPage,
  items,
  total,
  catalogTotal,
  votedIds,
}: {
  initialFilters: DiscoverFilterState;
  initialSortId: DiscoverSortId;
  initialQuery: string;
  initialPage: number;
  items: DiscoverItem[];
  total: number;
  catalogTotal: number;
  votedIds: string[];
}) {
  return (
    <FilterProvider
      initialFilters={initialFilters}
      initialSortId={initialSortId}
      initialQuery={initialQuery}
    >
      <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
        {/* ── HEADER & TOOLBAR (fond grille, même langage que la home) ── */}
        <div className="relative w-full border-b border-border/40">
          <GridBackground
            variant="css"
            showBottomFade={false}
            glowPlacement="centered"
            className="-bottom-24"
          />
          <div className="absolute inset-x-0 -bottom-24 h-10 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />
          <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-8">
            <div className="mb-6">
              <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
                Explorer la tech malgache
              </h1>
              <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-2 max-w-2xl">
                <span className="font-bold text-foreground">
                  {" "}
                  +{catalogTotal.toLocaleString("fr-FR")}{" "}
                </span>{" "}
                produits, apps, SaaS et outils construits par des makers de Madagascar. Découvrez,
                votez, et soutenez la scène locale.
              </p>
            </div>
            <div
              className="flex flex-row items-center gap-2 w-full"
              title="Raccourcis : Alt+K recherche, f filtres"
            >
              <DiscoverToolbar />
              <div className="lg:hidden shrink-0">
                <MobileFilterTrigger />
              </div>
            </div>
          </div>
        </div>

        <DiscoverLayout
          items={items}
          total={total}
          page={initialPage}
          searchQuery={initialQuery}
          votedIds={votedIds}
        />
      </div>
    </FilterProvider>
  );
}
