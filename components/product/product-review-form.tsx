"use client";

import { useState } from "react";
import { StarIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function ProductReviewForm() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-5 p-6 rounded-3xl border border-border/40 bg-muted/10">
      <div className="flex flex-col gap-1">
        <h3 className="text-[18px] font-extrabold tracking-tight">Laisser un avis</h3>
        <p className="text-[13px] font-medium text-muted-foreground">
          Partagez votre expérience avec ce produit pour aider les autres makers et utilisateurs.
        </p>
      </div>

      {/* Star Rating Picker */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Note globale</span>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="cursor-pointer transition-transform hover:scale-125 active:scale-110"
            >
              <StarIcon
                weight="fill"
                className={cn(
                  "w-7 h-7 transition-colors",
                  star <= (hovered || rating) ? "text-amber-500" : "text-border"
                )}
              />
            </button>
          ))}
          {(hovered || rating) > 0 && (
            <span className="text-[13px] font-bold text-muted-foreground ml-2">
              {["", "Mauvais", "Passable", "Correct", "Bien", "Excellent !"][hovered || rating]}
            </span>
          )}
        </div>
      </div>

      {/* Text Area */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Votre commentaire</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Décrivez ce qui vous a plu ou déplu, des cas d'usage concrets, ou ce qui pourrait être amélioré..."
          className="w-full min-h-28 resize-none rounded-2xl bg-background border border-border/40 focus:border-border px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all font-medium"
          rows={4}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Votre avis sera visible publiquement sur la fiche produit.</p>
        <button
          disabled={!rating || !text.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-[13px] font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <PaperPlaneRightIcon weight="fill" className="w-4 h-4" />
          Publier l'avis
        </button>
      </div>
    </div>
  );
}
