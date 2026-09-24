"use client";

import { SearchInput } from "@/components/ui/search-input";
import { FilterSheet } from "./filter-sheet";
import { SortAscendingIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { id: "votes", label: "Les + Votés" },
  { id: "comments", label: "Les + Commentés" },
  { id: "newest", label: "Les + Récents" },
  { id: "revenue", label: "Revenus MRR" },
];

interface DiscoverToolbarProps {
  onSearchChange: (val: string) => void;
}

export function DiscoverToolbar({ onSearchChange }: DiscoverToolbarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortId, setSortId] = useState("votes");
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortId)?.label ?? "Trier";

  return (
    // Always ONE row — flex-row even on mobile
    <div className="flex flex-row items-center gap-2 w-full">
      {/* Search — flex-1 so it fills remaining space */}
      <SearchInput
        variant="page"
        placeholder="Rechercher par nom, maker ou mot-clé..."
        showKbd={false}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 min-w-0"
      />

      {/* Sort + Filter — shrink, icon-only on mobile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Sort trigger */}
        <div className="relative">
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={cn(
              // on mobile: icon-only square pill; on sm+: expanded with label
              "flex items-center justify-center gap-0 sm:gap-2.5",
              "h-10 w-10 sm:w-auto sm:px-4 rounded-full",
              "bg-background border border-border/60 shadow-sm",
              "hover:bg-muted/40 transition-colors",
            )}
            aria-label="Trier les produits"
          >
            <SortAscendingIcon
              weight="bold"
              className="w-4.5 h-4.5 text-muted-foreground shrink-0"
            />
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
              {/* Click-outside overlay */}
              <div className="fixed inset-0 z-[70]" onClick={() => setIsSortOpen(false)} />
              {/* Dropdown */}
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

        {/* Filter trigger — icon-only on mobile handled inside FilterSheet */}
        <FilterSheet />
      </div>
    </div>
  );
}
