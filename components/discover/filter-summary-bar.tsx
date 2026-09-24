"use client";

import { XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface FilterSummaryBarProps {
  resultCount: number;
  activeFilters: { key: string; label: string }[];
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
}

/**
 * Appears below the toolbar when at least one filter is active.
 * Shows the result count + mini-pills for each active filter.
 */
export function FilterSummaryBar({
  resultCount,
  activeFilters,
  onRemoveFilter,
  onClearAll,
}: FilterSummaryBarProps) {
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/30">
      {/* Count */}
      <span className="text-[13px] font-bold text-foreground shrink-0">
        {resultCount.toLocaleString("fr-FR")}{" "}
        <span className="text-muted-foreground font-medium">
          {resultCount === 1 ? "résultat" : "résultats"}
        </span>
      </span>

      <span className="text-border/60 text-sm select-none">·</span>

      {/* Active filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {activeFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => onRemoveFilter(f.key)}
            className={cn(
              "flex items-center gap-1 pl-2.5 pr-1.5 h-6 rounded-full",
              "bg-muted/60 border border-border/40 text-muted-foreground",
              "text-[11px] font-bold hover:border-border hover:text-foreground transition-colors group"
            )}
          >
            {f.label}
            <XIcon
              weight="bold"
              className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground transition-colors"
            />
          </button>
        ))}
      </div>

      {/* Clear all */}
      <button
        onClick={onClearAll}
        className="text-[12px] font-bold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors ml-1 shrink-0"
      >
        Effacer tout
      </button>
    </div>
  );
}
