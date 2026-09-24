"use client";

import type { InputHTMLAttributes } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type SearchInputVariant = "nav" | "page";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: SearchInputVariant;
  showKbd?: boolean;
}

// Shared search — nav (compact, Alt K) et page (full-width).
// Contrôlé (value/onChange) pour filtrer, non-contrôlé par défaut.
export function SearchInput({
  variant = "nav",
  placeholder = "Rechercher...",
  showKbd,
  className,
  ...props
}: SearchInputProps) {
  const isNav = variant === "nav";
  const kbd = showKbd ?? isNav;

  return (
    <div className={cn("relative", isNav ? "hidden lg:block" : "w-full", className)}>
      <MagnifyingGlassIcon
        weight="bold"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none",
          isNav ? "left-4 h-4.5 w-4.5" : "left-4 h-5 w-5 text-muted-foreground",
        )}
      />
      <input
        type="search"
        placeholder={placeholder}
        className={cn(
          "transition-all focus:outline-none placeholder:text-muted-foreground/70",
          isNav
            ? "h-10 w-64 rounded-full bg-muted/50 border border-transparent pl-11 pr-14 text-[14px] focus:border-border/60 focus:bg-background"
            : "h-12 w-full rounded-2xl bg-muted/50 border border-transparent pl-12 pr-4 text-[15px] font-medium focus:border-border/60 focus:bg-background",
        )}
        {...props}
      />
      {kbd && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-background border border-border/60 px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
          Alt K
        </div>
      )}
    </div>
  );
}
