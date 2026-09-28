"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { FadersIcon, XIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  EMPTY_DISCOVER_FILTERS,
  buildDiscoverHref,
  countActiveFilters,
  toggleInArray,
  type DiscoverFilterState,
} from "@/lib/discover-filters";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/config/categories";
import { PRODUCT_TYPES, type ProductType } from "@/config/product-types";
import { AGE_RATINGS, type AgeRating } from "@/config/ratings";
import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/config/lifecycle";
import { PLATFORMS, type Platform } from "@/config/platforms";
import { PRICING_MODELS, type PricingModel } from "@/config/pricing";
import { ActionButton } from "@/components/ui/action-button";

export type DiscoverSortId = "votes" | "comments" | "newest" | "revenue";

interface FilterContextValue {
  /** État filtrant — seedé par l'URL (cf. lib/discover-filters). */
  filters: DiscoverFilterState;
  /** Patch → navigation shallow. Seul point d'écriture de l'URL. */
  applyFilters: (patch: Partial<DiscoverFilterState>) => void;
  reset: () => void;
  activeCount: number;
  /** Préférence UI pure, hors URL : sidebar pliée (localStorage). */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Préférence UI pure, hors URL : tri de la grille. */
  sortId: DiscoverSortId;
  setSortId: (v: DiscoverSortId) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({
  initialFilters,
  children,
}: {
  initialFilters: DiscoverFilterState;
  children: ReactNode;
}) {
  const router = useRouter();
  // Seedé depuis l'URL une fois par navigation serveur : pas d'effet de
  // synchronisation, donc pas de flash ni de boucle.
  const [filters, setFilters] = useState<DiscoverFilterState>(initialFilters);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    // Lu une fois à l'init (pas d'effect) : pas de flash ouvert → fermé.
    // SSR : `window` absent → défaut (ouverte). Cas limite assumé : si le
    // stockage disait "fermé", l'hydratation corrige sans erreur bloquante.
    try {
      if (typeof window === "undefined") return true;
      return localStorage.getItem("discover:sidebar") !== "closed";
    } catch {
      return true;
    }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("discover:sidebar", next ? "open" : "closed");
      } catch {
        // stockage indisponible : état mémoire seul
      }
      return next;
    });
  }, []);

  const [sortId, setSortId] = useState<DiscoverSortId>("votes");

  /**
   * Miroir de `filters` pour la navigation.
   *
   * `router.push` **ne doit pas** être appelé dans l'updater de `setFilters` :
   * React exécute cet updater pendant sa phase de render, donc la navigation
   * était déclenchée *pendant le rendu* — d'où l'erreur console « Cannot
   * update a component (`Router`) while rendering a different component
   * (`FilterProvider`) », et d'où le saut en haut de page (la navigation
   * dispatchée au mauvais moment n'a jamais préservé le scroll). On calcule
   * donc `next` hors du render via ce ref, puis on pose l'état et on navigue.
   */
  const filtersRef = useRef<DiscoverFilterState>(initialFilters);

  const applyFilters = useCallback(
    (patch: Partial<DiscoverFilterState>) => {
      const next = { ...filtersRef.current, ...patch };
      filtersRef.current = next;
      setFilters(next);
      router.push(buildDiscoverHref(next), { scroll: false });
    },
    [router],
  );

  const reset = useCallback(() => {
    filtersRef.current = EMPTY_DISCOVER_FILTERS;
    setFilters(EMPTY_DISCOVER_FILTERS);
    router.push(buildDiscoverHref(EMPTY_DISCOVER_FILTERS), { scroll: false });
  }, [router]);

  const activeCount = countActiveFilters(filters);

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      applyFilters,
      reset,
      activeCount,
      sidebarOpen,
      toggleSidebar,
      sortId,
      setSortId,
    }),
    [filters, applyFilters, reset, activeCount, sidebarOpen, toggleSidebar, sortId],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}

/* ─────────────────────────── Chips & groupes ─────────────────────────── */

function FilterChip({
  label,
  icon: IconComp,
  isSelected,
  onClick,
  hoverClass = "hover:bg-muted/60 hover:text-foreground hover:border-border",
  selectedClass = "bg-foreground text-background border-foreground shadow-md",
  iconWeight = "fill",
  title,
  className,
}: {
  label: string;
  icon?: React.ElementType;
  isSelected: boolean;
  onClick: () => void;
  hoverClass?: string;
  selectedClass?: string;
  iconWeight?: "fill" | "bold" | "duotone" | "regular";
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      title={title}
      className={cn(
        "relative border text-left px-3 py-2 rounded-full flex items-center gap-2 transition-all duration-200 cursor-pointer text-[13px] font-bold whitespace-nowrap shrink-0",
        isSelected ? selectedClass : cn("border-border/40 bg-muted/20 text-foreground", hoverClass),
        className,
      )}
    >
      {IconComp && (
        <IconComp
          weight={isSelected ? "fill" : iconWeight}
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-colors",
            isSelected ? "text-background" : "text-muted-foreground",
          )}
        />
      )}
      <span className={cn(isSelected ? "text-background" : "text-foreground")}>{label}</span>
    </button>
  );
}

function FilterGroup({
  title,
  children,
  isCollapsed,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="flex items-center justify-between w-full px-1"
      >
        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        <CaretDownIcon
          weight="bold"
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isCollapsed && "rotate-180",
          )}
        />
      </button>
      {!isCollapsed && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Groupes repliés par défaut (hauteur maîtrisée en flux naturel). */
const DEFAULT_COLLAPSED: Record<string, boolean> = {
  types: true,
  ages: true,
  lifecycle: true,
};

/* ─────────────────────────── Contenu partagé ─────────────────────────── */

function FilterSections({ onNavigate }: { onNavigate?: () => void }) {
  const { filters, applyFilters } = useFilters();
  const [showAllCats, setShowAllCats] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED);

  const toggleGroup = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const displayedCats = showAllCats ? PRODUCT_CATEGORIES : PRODUCT_CATEGORIES.slice(0, 9);

  return (
    <>
      <FilterGroup
        title="Catégories"
        isCollapsed={collapsed.categories ?? false}
        onToggle={() => toggleGroup("categories")}
      >
        <FilterChip
          label="Toutes"
          isSelected={filters.cat == null}
          onClick={() => {
            applyFilters({ cat: null });
            onNavigate?.();
          }}
        />
        {displayedCats.map((c: ProductCategory) => (
          <FilterChip
            key={c.id}
            label={c.name}
            icon={c.icon}
            isSelected={filters.cat === c.id}
            onClick={() => {
              applyFilters({ cat: filters.cat === c.id ? null : c.id });
              onNavigate?.();
            }}
            hoverClass={c.hoverClass}
            selectedClass={c.selectedClass}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowAllCats(!showAllCats)}
          className="flex items-center gap-1 px-3 py-2 rounded-full border border-dashed border-border/60 text-muted-foreground text-[12px] font-bold hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
          {showAllCats ? "Voir moins" : `+ ${PRODUCT_CATEGORIES.length - 9} de plus`}
          <CaretDownIcon
            weight="bold"
            className={cn("w-3 h-3 transition-transform", showAllCats && "rotate-180")}
          />
        </button>
      </FilterGroup>

      <hr className="border-border/30" />

      <FilterGroup
        title="Type de produit"
        isCollapsed={collapsed.types ?? false}
        onToggle={() => toggleGroup("types")}
      >
        {PRODUCT_TYPES.map((t: ProductType) => (
          <FilterChip
            key={t.id}
            label={t.label}
            icon={t.icon}
            isSelected={filters.types.includes(t.id)}
            onClick={() => {
              applyFilters({ types: toggleInArray(filters.types, t.id) });
              onNavigate?.();
            }}
          />
        ))}
      </FilterGroup>

      <hr className="border-border/30" />

      <FilterGroup
        title="Plateformes"
        isCollapsed={collapsed.platforms ?? false}
        onToggle={() => toggleGroup("platforms")}
      >
        {PLATFORMS.map((p: Platform) => (
          <FilterChip
            key={p.id}
            label={p.label}
            icon={p.icon}
            isSelected={filters.platforms.includes(p.id)}
            onClick={() => {
              applyFilters({ platforms: toggleInArray(filters.platforms, p.id) });
              onNavigate?.();
            }}
          />
        ))}
      </FilterGroup>

      <hr className="border-border/30" />

      <FilterGroup
        title="Modèle économique"
        isCollapsed={collapsed.pricing ?? false}
        onToggle={() => toggleGroup("pricing")}
      >
        {PRICING_MODELS.map((p: PricingModel) => (
          <FilterChip
            key={p.id}
            label={p.label}
            icon={p.icon}
            isSelected={filters.pricing.includes(p.id)}
            onClick={() => {
              applyFilters({ pricing: toggleInArray(filters.pricing, p.id) });
              onNavigate?.();
            }}
          />
        ))}
      </FilterGroup>

      <hr className="border-border/30" />

      <FilterGroup
        title="Classification d'âge"
        isCollapsed={collapsed.ages ?? false}
        onToggle={() => toggleGroup("ages")}
      >
        {AGE_RATINGS.map((r: AgeRating) => (
          <FilterChip
            key={r.id}
            label={r.short}
            title={r.description}
            isSelected={filters.ages.includes(r.id)}
            onClick={() => {
              applyFilters({ ages: toggleInArray(filters.ages, r.id) });
              onNavigate?.();
            }}
          />
        ))}
      </FilterGroup>

      <hr className="border-border/30" />

      <FilterGroup
        title="Avancement"
        isCollapsed={collapsed.lifecycle ?? false}
        onToggle={() => toggleGroup("lifecycle")}
      >
        {LIFECYCLE_STATUS.map((l: LifecycleStatus) => (
          <FilterChip
            key={l.id}
            label={l.label}
            icon={l.icon}
            isSelected={filters.lifecycle.includes(l.id)}
            onClick={() => {
              applyFilters({ lifecycle: toggleInArray(filters.lifecycle, l.id) });
              onNavigate?.();
            }}
            hoverClass={`hover:${l.pillClass.split(" ").join(" hover:")}`}
            selectedClass={l.pillClass}
            iconWeight="bold"
          />
        ))}
      </FilterGroup>
    </>
  );
}

/* ─────────────────────────── Sidebar desktop ─────────────────────────── */

export function SidebarFilter() {
  const { reset, activeCount } = useFilters();

  return (
    <div className="lg:sticky lg:top-24 self-start p-4 space-y-6 border-r border-border/40 bg-background">
      <div className="flex items-center justify-between px-1 pb-3 border-b border-border/40 shrink-0">
        <h2 className="text-[15px] font-extrabold tracking-tight">Filtres</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-[12px] font-bold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
          >
            Tout effacer
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 px-1">
        <FilterSections />
      </div>

      {/* Rappel d'état : les filtres vivent dans l'URL, donc partageables. */}
      {activeCount > 0 && (
        <p className="text-[11px] text-muted-foreground/80 leading-snug px-1">
          {activeCount} filtre{activeCount === 1 ? "" : "s"} actif{activeCount === 1 ? "" : "s"} —
          cette vue est partageable via l&apos;URL.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── Modale mobile ─────────────────────────── */

export function MobileFilterTrigger() {
  const { activeCount, reset } = useFilters();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (isOpen && isMobile) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex items-center justify-center gap-0 sm:gap-2",
          "h-10 w-10 sm:w-auto sm:px-5 rounded-full",
          "bg-foreground text-background font-bold text-[13px]",
          "hover:scale-[1.02] active:scale-95 transition-all",
        )}
      >
        <FadersIcon weight="fill" className="w-4 h-4" />
        <span className="hidden sm:inline">Filtres</span>
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:hidden">
          <style>{`
            .discover-modal-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--border) 55%, transparent) transparent; }
            .discover-modal-scroll::-webkit-scrollbar { width: 6px; }
            .discover-modal-scroll::-webkit-scrollbar-track { background: transparent; }
            .discover-modal-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--border) 55%, transparent); border-radius: 9999px; }
            .discover-modal-scroll::-webkit-scrollbar-thumb:hover { background: var(--border); }
          `}</style>
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-[3px]"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-[500px] max-h-[90vh] bg-background border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
              <h2 className="text-[17px] font-extrabold tracking-tight">Filtres de recherche</h2>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Fermer les filtres"
                className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <XIcon weight="bold" className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="discover-modal-scroll flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              <FilterSections onNavigate={() => setIsOpen(false)} />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0">
              <button
                type="button"
                onClick={reset}
                className="text-[13px] font-bold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
              >
                Réinitialiser
              </button>
              <ActionButton
                actionType="button"
                isFullWidthOnMobile={false}
                onClick={() => setIsOpen(false)}
                className="h-11 px-7 text-[14px]"
              >
                {activeCount > 0 ? `Appliquer (${activeCount})` : "Appliquer"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
