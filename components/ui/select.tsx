"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { CaretDownIcon, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function Select({
  value,
  onChange,
  options,
  icon,
  placeholder = "Sélectionner...",
  className,
  size = "md",
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  icon?: ReactNode;
  placeholder?: string;
  className?: string;
  /** md = champ formulaire, sm = filtre compact pill */
  size?: "md" | "sm";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "w-full bg-background border border-border/60 flex items-center justify-between text-left text-foreground outline-none focus:border-foreground/40 hover:border-foreground/20 transition-colors cursor-pointer z-10 relative group",
          size === "sm"
            ? "h-10 rounded-full px-4 gap-2 text-[13px] font-bold"
            : "rounded-2xl px-5 py-4 text-[15px] font-medium",
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          {selectedOption?.icon}
          {selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-muted-foreground/30 truncate">{placeholder}</span>
          )}
        </span>
        <CaretDownIcon weight="bold" className={cn("text-muted-foreground/60 transition-transform duration-200 shrink-0", size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.5rem)] w-full rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-2.5 shadow-2xl flex flex-col gap-1 z-50 max-h-64 overflow-y-auto"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={value === option.id}
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-bold transition-colors cursor-pointer",
                value === option.id ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {option.icon}
              <span className="flex-1 min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description && (
                  <span className="block text-[12px] font-medium text-muted-foreground truncate">
                    {option.description}
                  </span>
                )}
              </span>
              {value === option.id && <CheckCircle weight="fill" className="w-4 h-4 text-emerald-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}