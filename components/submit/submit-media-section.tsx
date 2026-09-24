"use client";

import { ImageSquareIcon, ImagesIcon, PlusIcon } from "@phosphor-icons/react";
import { DeviceMobileIcon, MonitorIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";

export function SubmitMediaSection() {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Logo &amp; captures d&apos;écran</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Téléversez un logo carré et des aperçus de votre produit en action.
        </p>
      </div>

      {/* Logo Upload */}
      <div className="flex flex-col gap-3 mt-4">
        <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
          App logo ou icône
          <FieldBadge variant="required" />
        </label>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-transparent border border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground shrink-0 overflow-hidden relative group cursor-pointer transition-colors hover:border-foreground/40 hover:bg-muted/10">
            <ImageSquareIcon
              weight="duotone"
              className="w-8 h-8 opacity-40 mb-1 group-hover:opacity-70 transition-opacity"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-70 transition-opacity">
              Logo
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <button className="self-start px-6 py-2.5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-80 transition-opacity cursor-pointer">
              Upload logo
            </button>
            <p className="text-[12px] font-medium text-muted-foreground max-w-50 leading-relaxed">
              Format carré PNG, JPG, ou WebP — au moins 256x256, max 6 Mo.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border/40 my-2" />

      {/* Screenshots Upload */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
              Captures d&apos;écran
              <FieldBadge variant="required" />
            </label>
            <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
              Au moins 1 capture requise, jusqu&apos;à 4 — PNG, JPG, ou WebP, max 6 Mo chacune.
            </p>
          </div>

          {/* Orientation Toggle */}
          <div className="flex items-center p-1 rounded-full border border-border/40 bg-transparent">
            <button
              onClick={() => setOrientation("portrait")}
              className={cn(
                "px-5 py-2.5 text-[13px] font-bold rounded-full transition-all cursor-pointer flex items-center gap-2",
                orientation === "portrait"
                  ? "bg-background text-foreground shadow-md ring-1 ring-border/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <DeviceMobileIcon
                weight={orientation === "portrait" ? "fill" : "regular"}
                className="w-4.5 h-4.5"
              />
              Portrait
            </button>
            <button
              onClick={() => setOrientation("landscape")}
              className={cn(
                "px-5 py-2.5 text-[13px] font-bold rounded-full transition-all cursor-pointer flex items-center gap-2",
                orientation === "landscape"
                  ? "bg-background text-foreground shadow-md ring-1 ring-border/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <MonitorIcon
                weight={orientation === "landscape" ? "fill" : "regular"}
                className="w-4.5 h-4.5"
              />
              Paysage
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid gap-4 mt-2",
            orientation === "portrait"
              ? "grid-cols-2 lg:grid-cols-4"
              : "grid-cols-1 lg:grid-cols-2",
          )}
        >
          {/* Uploader slot */}
          <button
            className={cn(
              "w-full rounded-4xl bg-transparent hover:bg-muted/5 border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2.5 transition-colors text-muted-foreground cursor-pointer group shadow-sm",
              orientation === "portrait" ? "aspect-9/16" : "aspect-video",
            )}
          >
            <PlusIcon
              weight="regular"
              className="w-7 h-7 opacity-70 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-[14px] font-bold opacity-80 group-hover:opacity-100 transition-opacity">
              Ajouter
            </span>
          </button>

          {/* Empty placeholders for max 4 */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-full rounded-4xl bg-transparent border-2 border-dashed border-border/30 flex items-center justify-center text-muted-foreground/30 shadow-sm",
                orientation === "portrait" ? "aspect-9/16" : "aspect-video",
              )}
            >
              <ImagesIcon
                weight="duotone"
                className="w-9 h-9 opacity-40 hover:opacity-70 transition-opacity"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
