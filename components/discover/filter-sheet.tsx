"use client";

import { useState, useEffect } from "react";
import { FadersIcon, XIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/config/categories";
import { PRODUCT_TYPES, type ProductType } from "@/config/product-types";
import { AGE_RATINGS, type AgeRating } from "@/config/ratings";
import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/config/lifecycle";
import { PLATFORMS, type Platform } from "@/config/platforms";
import { PRICING_MODELS, type PricingModel } from "@/config/pricing";
import { ActionButton } from "@/components/ui/action-button";

function FilterChip({
  label,
  icon: IconComp,
  isSelected,
  onClick,
  hoverClass = "hover:bg-muted/60 hover:text-foreground hover:border-border",
  selectedClass = "bg-foreground text-background border-foreground shadow-md",
  iconWeight = "fill",
}: {
  label: string;
  icon?: React.ElementType;
  isSelected: boolean;
  onClick: () => void;
  hoverClass?: string;
  selectedClass?: string;
  iconWeight?: "fill" | "bold" | "duotone" | "regular";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative border text-left px-3 py-2 rounded-full flex items-center gap-2 transition-all duration-200 cursor-pointer text-[13px] font-bold",
        isSelected ? selectedClass : cn("border-border/40 bg-muted/20 text-foreground", hoverClass),
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
      <span className={cn("whitespace-nowrap", isSelected ? "text-background" : "text-foreground")}>
        {label}
      </span>
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function FilterSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);

  // Filter state
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAges, setSelectedAges] = useState<string[]>([]);
  const [selectedLifecycle, setSelectedLifecycle] = useState<string[]>([]);

  const toggleMulti = (set: string[], setFn: (v: string[]) => void, id: string) => {
    setFn(set.includes(id) ? set.filter((x) => x !== id) : [...set, id]);
  };

  const activeCount = [
    selectedCat ? 1 : 0,
    selectedPlatforms.length,
    selectedPricing.length,
    selectedTypes.length,
    selectedAges.length,
    selectedLifecycle.length,
  ].reduce((a, b) => a + b, 0);

  const handleReset = () => {
    setSelectedCat(null);
    setSelectedPlatforms([]);
    setSelectedPricing([]);
    setSelectedTypes([]);
    setSelectedAges([]);
    setSelectedLifecycle([]);
  };

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const displayedCats = showAllCats ? PRODUCT_CATEGORIES : PRODUCT_CATEGORIES.slice(0, 9);

  return (
    <>
      {/* ── Trigger pill ──────────────────────────────────────────────── */}
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

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-[3px]"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-[500px] max-h-[85vh] bg-background border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
              <h2 className="text-[17px] font-extrabold tracking-tight">Filtres de recherche</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <XIcon weight="bold" className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-7">
              {/* ── CATÉGORIES ── */}
              <FilterGroup title="Catégories">
                <FilterChip
                  label="Toutes"
                  isSelected={selectedCat === null}
                  onClick={() => setSelectedCat(null)}
                />
                {displayedCats.map((c: ProductCategory) => (
                  <FilterChip
                    key={c.id}
                    label={c.name}
                    icon={c.icon}
                    isSelected={selectedCat === c.id}
                    onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                    hoverClass={c.hoverClass}
                    selectedClass={c.selectedClass}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowAllCats(!showAllCats)}
                  className="flex items-center gap-1 px-3 py-2 rounded-full border border-dashed border-border/60 text-muted-foreground text-[12px] font-bold hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
                >
                  {showAllCats ? "Voir moins" : `+ ${PRODUCT_CATEGORIES.length - 9} de plus`}
                  <CaretDownIcon
                    weight="bold"
                    className={cn("w-3 h-3 transition-transform", showAllCats && "rotate-180")}
                  />
                </button>
              </FilterGroup>

              <hr className="border-border/30" />

              {/* ── PLATEFORMES ── */}
              <FilterGroup title="Plateformes">
                {PLATFORMS.map((p: Platform) => (
                  <FilterChip
                    key={p.id}
                    label={p.label}
                    icon={p.icon}
                    isSelected={selectedPlatforms.includes(p.id)}
                    onClick={() => toggleMulti(selectedPlatforms, setSelectedPlatforms, p.id)}
                  />
                ))}
              </FilterGroup>

              <hr className="border-border/30" />

              {/* ── MODÈLE ÉCONOMIQUE ── */}
              <FilterGroup title="Modèle économique">
                {PRICING_MODELS.map((p: PricingModel) => (
                  <FilterChip
                    key={p.id}
                    label={p.label}
                    icon={p.icon}
                    isSelected={selectedPricing.includes(p.id)}
                    onClick={() => toggleMulti(selectedPricing, setSelectedPricing, p.id)}
                  />
                ))}
              </FilterGroup>

              <hr className="border-border/30" />

              {/* ── TYPE DE PRODUIT ── */}
              <FilterGroup title="Type de produit">
                {PRODUCT_TYPES.map((t: ProductType) => (
                  <FilterChip
                    key={t.id}
                    label={t.label}
                    icon={t.icon}
                    isSelected={selectedTypes.includes(t.id)}
                    onClick={() => toggleMulti(selectedTypes, setSelectedTypes, t.id)}
                  />
                ))}
              </FilterGroup>

              <hr className="border-border/30" />

              {/* ── CLASSIFICATION D'ÂGE ── */}
              <FilterGroup title="Classification d'âge">
                {AGE_RATINGS.map((r: AgeRating) => (
                  <FilterChip
                    key={r.id}
                    label={`${r.badge} — ${r.label}`}
                    isSelected={selectedAges.includes(r.id)}
                    onClick={() => toggleMulti(selectedAges, setSelectedAges, r.id)}
                  />
                ))}
              </FilterGroup>

              <hr className="border-border/30" />

              {/* ── AVANCEMENT (LIFECYCLE) ── */}
              <FilterGroup title="Avancement">
                {LIFECYCLE_STATUS.map((l: LifecycleStatus) => (
                  <FilterChip
                    key={l.id}
                    label={l.label}
                    icon={l.icon}
                    isSelected={selectedLifecycle.includes(l.id)}
                    onClick={() => toggleMulti(selectedLifecycle, setSelectedLifecycle, l.id)}
                    hoverClass={`hover:${l.pillClass.split(" ").join(" hover:")}`}
                    selectedClass={l.pillClass}
                    iconWeight="bold"
                  />
                ))}
              </FilterGroup>
            </div>

            {/* Sticky Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0">
              {/* Text-only destructive reset */}
              <button
                type="button"
                onClick={handleReset}
                className="text-[13px] font-bold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
              >
                Réinitialiser
              </button>

              {/* Shared ActionButton */}
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
