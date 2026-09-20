"use client";

import { PRODUCT_CATEGORIES } from "@/config/categories";
import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm } from "@/components/submit/submit-form-context";

const MAX_TAGS = 5;

export function SubmitCategoriesSection() {
  const { editApp } = useSubmitForm();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    editApp ? [editApp.categoryId] : [],
  );
  // Tags libres — état string[] prêt pour la table product_tags (backend)
  const [tags, setTags] = useState<string[]>(editApp?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const commitTag = (raw: string) => {
    const value = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!value || tags.includes(value) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, value]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black tracking-tight">Catégories</h2>
          <FieldBadge variant="required" />
          <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-black tracking-widest text-muted-foreground uppercase">
            {selectedIds.length} / 3
          </span>
        </div>
        <p className="text-[14px] font-medium text-muted-foreground">
          Sélectionnez au moins 1 catégorie pertinente, jusqu&apos;à 3. La
          première sélectionnée devient la catégorie principale.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRODUCT_CATEGORIES.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          const isMain = selectedIds[0] === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={cn(
                "group relative border text-left px-4 py-2.5 rounded-full flex items-center gap-2.5 transition-all duration-200 cursor-pointer",
                isSelected
                  ? cn("shadow-md", cat.selectedClass)
                  : cn("border-border/40 bg-muted/20 hover:border-border/80 hover:bg-muted/50", cat.hoverClass)
              )}
            >
              <cat.icon
                weight={isSelected ? "fill" : "duotone"}
                className={cn(
                  "w-4 h-4 transition-colors",
                  isSelected ? "text-background" : cn("text-muted-foreground", cat.hoverColor)
                )}
              />
              <span className={cn(
                "text-[13px] font-bold transition-colors whitespace-nowrap",
                isSelected ? "text-background" : cn("text-foreground group-hover:text-foreground", cat.hoverColor)
              )}>
                {cat.name}
              </span>
              
              {isMain && (
                <div className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-background">
                   <span className="text-[9px] font-black text-foreground">1</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tags libres (optionnel, max 5) ── */}
      <div className="flex flex-col gap-3 mt-2">
        <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
          Tags libres
          <FieldBadge variant="optional" />
          <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-black tracking-widest text-muted-foreground uppercase">
            {tags.length} / {MAX_TAGS}
          </span>
        </label>
        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Mots-clés libres pour affiner la découverte (ex : mobile-money,
          offline-first). Entrée ou virgule pour ajouter.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-background border border-border/60 px-4 py-3 focus-within:border-foreground/40 hover:border-foreground/20 transition-colors">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/40 pl-3 pr-1.5 py-1 text-[13px] font-bold text-foreground"
            >
              #{tag}
              <button
                type="button"
                onClick={() =>
                  setTags((prev) => prev.filter((t) => t !== tag))
                }
                aria-label={`Retirer le tag ${tag}`}
                className="flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <XIcon weight="bold" className="w-3 h-3" />
              </button>
            </span>
          ))}
          {tags.length < MAX_TAGS && (
            <input
              value={tagInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v.endsWith(",")) {
                  commitTag(v.slice(0, -1));
                  setTagInput("");
                } else {
                  setTagInput(v);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTag(tagInput);
                  setTagInput("");
                } else if (
                  e.key === "Backspace" &&
                  tagInput === "" &&
                  tags.length > 0
                ) {
                  setTags((prev) => prev.slice(0, -1));
                }
              }}
              onBlur={() => {
                commitTag(tagInput);
                setTagInput("");
              }}
              placeholder={tags.length === 0 ? "ex : mvola, hors-ligne…" : ""}
              className="flex-1 min-w-32 bg-transparent border-none outline-none text-[14px] font-medium placeholder:text-muted-foreground/30 text-foreground py-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
