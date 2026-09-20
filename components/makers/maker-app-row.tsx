"use client";

import * as React from "react";
import Link from "next/link";
import {
  CaretUpIcon,
  StarIcon,
  SealCheckIcon,
  ArrowSquareOutIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getRatingById } from "@/config/ratings";
import { AgeBadge } from "@/components/ui/age-badge";
import { TagPill } from "@/components/ui/tag-pill";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import {
  formatCompactAr,
  formatCompactCount,
  type DashboardApp,
} from "@/components/dashboard/dashboard-mock";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <GlobeIcon weight="fill" className="w-3.5 h-3.5" />,
  ios: <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />,
  android: <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />,
};

function Dot() {
  return (
    <span
      className="w-0.75 h-0.75 rounded-full bg-border shrink-0"
      aria-hidden="true"
    />
  );
}

// Row publique maker — asymétrique aérée, info de découverte complète.
// Vote mock interactif (optimiste), MRR figure/badge selon display_mode.
export function MakerAppRow({ app }: { app: DashboardApp }) {
  const [voted, setVoted] = React.useState(false);
  const category = getCategoryById(app.categoryId);
  const rating = getRatingById(app.audienceId);

  return (
    <div className="group flex gap-4 py-6 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
      {/* Icon — animated like leaderboard */}
      <Link
        href={`/products/${app.id}`}
        className={cn(
          "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-base bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3",
          app.iconGradient,
        )}
      >
        {app.initials}
      </Link>

      {/* Body */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href={`/products/${app.id}`}
            className="text-lg font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
          >
            {app.name}
          </Link>
          {category && (
            <Link
              href={`/categories/${category.id}`}
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0 transition-colors",
                category.chipClass,
                category.hoverClass,
              )}
            >
              {category.name}
            </Link>
          )}
          <LifecyclePill lifecycleId={app.lifecycle} />
        </div>

        <p className="text-[14px] font-medium text-muted-foreground leading-snug line-clamp-1">
          {app.tagline}
        </p>

        {/* Meta — registre newest */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <StarIcon weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
            {app.rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </span>
          <Dot />
          <span className="flex items-center gap-1 text-muted-foreground">
            {app.platforms.map((p) => (
              <span key={p} title={p}>
                {PLATFORM_ICONS[p]}
              </span>
            ))}
          </span>
          <Dot />
          <AgeBadge value={rating.badge} size="xs" />
          <Dot />
          <span className="text-muted-foreground font-semibold">
            {app.pricing}
          </span>
        </div>

        {/* Bottom split — tags left, context right */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 flex-wrap min-w-0">
            {app.tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground/70 whitespace-nowrap shrink-0">
            {app.productType}
            {app.version && ` · ${app.version}`} · Lancée en {app.launchedAt}
          </span>
        </div>
      </div>

      {/* Rail */}
      <div className="flex flex-col items-end justify-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setVoted((v) => !v)}
          aria-pressed={voted}
          aria-label={`Voter pour ${app.name}`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold tabular-nums transition-colors cursor-pointer",
            voted
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-border/40 text-foreground hover:border-foreground/30 hover:bg-muted/50",
          )}
        >
          <CaretUpIcon
            weight="fill"
            className={cn(
              "w-4 h-4",
              voted ? "text-emerald-500" : "text-muted-foreground",
            )}
          />
          {formatCompactCount(app.votes + (voted ? 1 : 0))}
        </button>

        {app.revenue &&
          (app.revenue.displayMode === "badge_only" ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400"
              title="Revenus vérifiés — montant masqué par le maker"
            >
              <SealCheckIcon weight="fill" className="h-3.5 w-3.5" />
              Vérifié
            </span>
          ) : (
            <span
              className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
              title={`MRR vérifié via ${app.revenue.provider}`}
            >
              {formatCompactAr(app.revenue.mrrAr)}
            </span>
          ))}

        <Link
          href={`/products/${app.id}`}
          aria-label={`Voir ${app.name}`}
          className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
