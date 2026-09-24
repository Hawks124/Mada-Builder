"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  HourglassIcon,
  ArrowSquareOutIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { TagPill } from "@/components/ui/tag-pill";
import { MOCK_REVIEW_QUEUE, type ReviewItem } from "@/components/admin/admin-mock";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <GlobeIcon weight="fill" className="w-3.5 h-3.5" />,
  ios: <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />,
  android: <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />,
};

const SLA_HOURS = 24;

// File de revue (§9) : triage riche + Vérifier/Rejeter inline.
// L'APPROBATION vit uniquement en page détail (anti-clic accidentel).
// Backend : approveProduct / rejectProduct (server actions) + email maker.
export function ReviewQueue() {
  const [queue] = React.useState<ReviewItem[]>(MOCK_REVIEW_QUEUE);

  const sorted = [...queue].sort((a, b) => b.waitingHours - a.waitingHours);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <div className="h-14 w-14 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
          <CheckIcon weight="bold" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            File vide — beau travail
          </h2>
          <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
            Aucune soumission en attente. Objectif : revue sous 24 h.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sorted.map((item) => {
        const category = getCategoryById(item.categoryIds[0]);
        const exceeded = item.waitingHours > SLA_HOURS;
        return (
          <div key={item.id}>
            <div className="group flex gap-4 py-5 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
              {/* Logo */}
              <Link
                href={`/admin/review/${item.id}`}
                className={cn(
                  "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-base bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:scale-105",
                  item.iconGradient,
                )}
              >
                {item.initials}
              </Link>

              {/* Body */}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Link
                    href={`/admin/review/${item.id}`}
                    className="text-[16px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
                  >
                    {item.productName}
                  </Link>
                  {category && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
                        category.chipClass,
                      )}
                    >
                      {category.name}
                    </span>
                  )}
                  <LifecyclePill lifecycleId={item.lifecycle} />
                </div>

                <p className="text-[13px] font-medium text-muted-foreground leading-snug line-clamp-1">
                  {item.tagline}
                </p>

                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground flex-wrap">
                  <span>
                    par{" "}
                    <Link
                      href={`/makers/${item.makerUsername}`}
                      className="font-bold text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {item.makerName}
                    </Link>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    {item.platforms.map((p) => (
                      <span key={p} title={p}>
                        {PLATFORM_ICONS[p]}
                      </span>
                    ))}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{item.pricing}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-amber-600 dark:text-amber-400">
                    <HourglassIcon weight="fill" className="w-3.5 h-3.5" />
                    {item.waitingText}
                  </span>
                  {exceeded && (
                    <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                      Dépassé
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {item.tags.slice(0, 3).map((t) => (
                      <TagPill key={t} label={t} />
                    ))}
                  </span>
                </div>
              </div>

              {/* Action unique — Vérifier (primaire). Zéro verdict en liste. */}
              <div className="flex items-center shrink-0 self-center">
                <Link
                  href={`/admin/review/${item.id}`}
                  className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                  Vérifier
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
