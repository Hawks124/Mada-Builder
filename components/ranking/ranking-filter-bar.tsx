"use client";

import { useState } from "react";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PRODUCT_CATEGORIES, getCategoryById } from "@/config/categories";
import { PRODUCT_TYPES } from "@/config/product-types";

interface RankingFilterBarProps {
  selectedCat: string | null;
  onCatChange: (v: string | null) => void;
  selectedType: string | null;
  onTypeChange: (v: string | null) => void;
  resultCount: number;
  onReset: () => void;
}

/**
 * Un seul contrôle groupé (et non deux capsules jumeaux) : les deux
 * facettes partagent une seule bordure, ce qui les lit comme un seul
 * contrôle à deux dimensions plutôt que comme deux boutons concurrents.
 */
function GroupedDropdown({
  label,
  valueLabel,
  isActive,
  accentClass,
  children,
}: {
  label: string;
  valueLabel: string;
  isActive: boolean;
  /** Couleur de la facette choisie — l'encre du contrôle dit *quel* filtre. */
  accentClass?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Filtrer par ${label.toLowerCase()}`}
        className={cn(
          "flex items-center gap-2 h-10 pl-4 pr-3 text-[13px] font-bold transition-colors cursor-pointer",
          isActive
            ? (accentClass ?? "text-foreground")
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="whitespace-nowrap">{valueLabel}</span>
        <CaretDownIcon
          weight="bold"
          className={cn("w-3.5 h-3.5 transition-transform shrink-0", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={close} />
          <div className="absolute top-[calc(100%+6px)] left-0 w-72 max-h-96 overflow-y-auto bg-background border border-border/50 shadow-2xl rounded-2xl p-2 flex flex-col z-80">
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}

function Option({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors cursor-pointer w-full",
        selected
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Barre de filtres du classement taxonomique — contrôle groupé unique
 * (Catégorie × Type), vocabulaire issu des configs. Le résultat affiché
 * est le nombre de produits de la sélection courante.
 */
export function RankingFilterBar({
  selectedCat,
  onCatChange,
  selectedType,
  onTypeChange,
  resultCount,
  onReset,
}: RankingFilterBarProps) {
  const category = selectedCat == null ? null : getCategoryById(selectedCat);
  const type =
    selectedType == null ? null : (PRODUCT_TYPES.find((t) => t.id === selectedType) ?? null);

  const catLabel = category?.name ?? "Catégorie";
  const typeLabel = type?.label ?? "Type";
  const hasActive = selectedCat != null || selectedType != null;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Contrôle groupé : une bordure, deux facettes, un séparateur */}
      <div
        className={cn(
          "inline-flex items-center rounded-full border bg-background transition-colors shadow-sm",
          hasActive ? "border-border" : "border-border/60",
        )}
      >
        <GroupedDropdown
          label="catégorie"
          valueLabel={catLabel}
          isActive={selectedCat != null}
          accentClass={category?.hoverColor}
        >
          {(close) => (
            <>
              <Option
                label="Toutes les catégories"
                selected={selectedCat == null}
                onClick={() => {
                  onCatChange(null);
                  close();
                }}
              />
              {PRODUCT_CATEGORIES.map((c) => (
                <Option
                  key={c.id}
                  label={c.name}
                  icon={<c.icon weight="duotone" className="w-4 h-4 shrink-0" />}
                  selected={selectedCat === c.id}
                  onClick={() => {
                    onCatChange(selectedCat === c.id ? null : c.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </GroupedDropdown>

        {/* Séparateur interne : marque visuellement les deux dimensions */}
        <div className="w-px h-5 bg-border/60 shrink-0" aria-hidden="true" />

        <GroupedDropdown label="type" valueLabel={typeLabel} isActive={selectedType != null}>
          {(close) => (
            <>
              <Option
                label="Tous les types"
                selected={selectedType == null}
                onClick={() => {
                  onTypeChange(null);
                  close();
                }}
              />
              {PRODUCT_TYPES.map((t) => (
                <Option
                  key={t.id}
                  label={t.label}
                  icon={<t.icon weight="duotone" className="w-4 h-4 shrink-0" />}
                  selected={selectedType === t.id}
                  onClick={() => {
                    onTypeChange(selectedType === t.id ? null : t.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </GroupedDropdown>

        {hasActive && (
          <>
            <div className="w-px h-5 bg-border/60 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={onReset}
              aria-label="Effacer les filtres"
              className="flex items-center justify-center h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <XIcon weight="bold" className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <span
        className="text-[13px] font-bold text-foreground shrink-0 tabular-nums"
        aria-live="polite"
      >
        {resultCount.toLocaleString("fr-FR")}{" "}
        <span className="text-muted-foreground font-medium">
          {resultCount === 1 ? "produit" : "produits"}
        </span>
      </span>
    </div>
  );
}
