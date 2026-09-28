"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { FacetGrid, type FacetGroup } from "@/components/categories/category-index";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

export type CategoryView = "domaine" | "critere";

/**
 * `?vue=` est lu et résolu par le serveur (cf. `app/(site)/categories/page.tsx`) :
 * les deux vues sont deux URLs crawlables, rien n'est caché au DOM, et il
 * n'existe pas deux états à synchroniser. Le sélecteur est donc un `Link`,
 * pas un `onClick`.
 */
const VIEWS: { id: CategoryView; label: string; href: string; blurb: string }[] = [
  {
    id: "domaine",
    label: "Par domaine",
    href: "/categories",
    blurb: "Ce que font les produits, regroupé en familles.",
  },
  {
    id: "critere",
    label: "Par critère",
    href: "/categories?vue=criteres",
    blurb: "Le même catalogue, vu autrement — chaque axe mène à une vue filtrée.",
  },
];

function matches(item: FacetGroup["items"][number], needle: string): boolean {
  return (
    item.label.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle)
  );
}

/* ─────────────────────────── État partagé ─────────────────────────── */

/**
 * La barre de contrôle et la liste sont deux morceaux distincts de la page :
 * la première doit rester dans la zone couverte par le fond quadrillé, la
 * seconde au-delà du fondu. Les séparer casse donc leur parenté React, et
 * l'état de filtrage passe par un contexte plutôt que par des props.
 */
type CategoryFilter = {
  view: CategoryView;
  query: string;
  setQuery: (value: string) => void;
  groups: FacetGroup[];
  filtered: FacetGroup[];
  total: number;
  shown: number;
};

const FilterContext = createContext<CategoryFilter | null>(null);

function useCategoryFilter(): CategoryFilter {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useCategoryFilter utilisé hors CategoriesFilterProvider");
  return ctx;
}

export function CategoriesFilterProvider({
  view,
  groups,
  children,
}: {
  view: CategoryView;
  groups: FacetGroup[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((item) => matches(item, needle)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const shown = useMemo(() => filtered.reduce((n, g) => n + g.items.length, 0), [filtered]);

  return (
    <FilterContext.Provider value={{ view, query, setQuery, groups, filtered, total, shown }}>
      {children}
    </FilterContext.Provider>
  );
}

/* ───────────────────────── Barre de contrôle ───────────────────────── */

/**
 * Sélecteur de vue + recherche. Seule la recherche est interactive : la
 * vue se choisit par URL pour rester indexable.
 */
export function CategoriesControls() {
  const { view, query, setQuery, total, shown } = useCategoryFilter();
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const noun = view === "domaine" ? "domaines" : "entrées";

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between gap-y-6">
      <div className="flex flex-col gap-3">
        <nav
          aria-label="Vue du catalogue"
          className="flex flex-wrap items-center gap-1 self-start rounded-full border border-border/50 bg-muted/40 p-1"
        >
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <Link
                key={v.id}
                href={v.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
        <p className="text-muted-foreground font-medium tracking-tight max-w-xl">{current.blurb}</p>
        {query.trim() && (
          <p className="text-[13px] font-bold text-foreground">
            {shown} {noun} sur {total} — filtré sur « {query.trim()} »
          </p>
        )}
      </div>

      <div className="md:w-80 md:shrink-0">
        <SearchInput
          variant="page"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={view === "domaine" ? "Filtrer les domaines…" : "Filtrer les axes…"}
          aria-label="Filtrer le catalogue"
        />
      </div>
    </div>
  );
}

/* ───────────────────────────── Liste ───────────────────────────── */

export function CategoriesList() {
  const { view, query, setQuery, filtered, total } = useCategoryFilter();
  const noun = view === "domaine" ? "domaine" : "axe";

  if (filtered.length > 0) {
    return <FacetGrid groups={filtered} collapsible={view === "critere"} />;
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-border/50 bg-muted/30 px-6 py-10 max-w-xl">
      <p className="text-[15px] font-bold text-foreground">
        Aucun résultat pour « {query.trim()} »
      </p>
      <p className="text-[14px] text-muted-foreground">
        Aucun {noun} ne correspond. Essayez un terme plus court, ou repartez de la liste complète de{" "}
        {total}.
      </p>
      <button
        type="button"
        onClick={() => setQuery("")}
        className="inline-flex items-center gap-2 text-[13px] font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
      >
        <ArrowCounterClockwiseIcon weight="bold" className="h-3.5 w-3.5" />
        Réinitialiser la recherche
      </button>
    </div>
  );
}
