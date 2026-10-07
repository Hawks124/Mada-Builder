"use client";

import * as React from "react";
import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HourglassIcon,
  ArrowSquareOutIcon,
  BellRingingIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { getCategoryById } from "@/config/categories";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { TagPill } from "@/components/ui/tag-pill";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReviewItem } from "@/components/admin/admin-mock";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <GlobeIcon weight="fill" className="w-3.5 h-3.5" />,
  ios: <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />,
  android: <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />,
};

const SLA_HOURS = 24;

// File de revue (§9) : triage riche + Vérifier/Rejeter inline.
// L'APPROBATION vit uniquement en page détail (anti-clic accidentel).
// Items réels (file DB) — file vide = état honnête, jamais de mock.
// Variante `rejected` : MÊME design, MÊMES métadonnées (logo, tags,
// plateformes, maker) — seules différences : pill "Rejeté" (pas de SLA)
// et bouton "Rappeler" (au lieu de "Vérifier"), avec verrou cooldown.
export function ReviewQueue({
  items,
  variant = "review",
  onNudge,
}: {
  items: ReviewItem[];
  variant?: "review" | "rejected";
  /** Rappel maker (variante rejected) : actions serveur, `{ok, message}`. */
  onNudge?: (id: string) => Promise<{ ok: boolean; message: string | null }>;
}) {
  const router = useRouter();
  const [nudging, setNudging] = React.useState<string | null>(null);
  const rejected = variant === "rejected";
  const sorted = [...items].sort((a, b) => b.waitingHours - a.waitingHours);

  const nudge = (id: string) => {
    if (!onNudge || nudging) return;
    setNudging(id);
    startTransition(async () => {
      const res = await onNudge(id);
      setNudging(null);
      toast(res.ok ? "ok" : "err", res.message ?? "Rappel impossible.");
      if (res.ok) router.refresh();
    });
  };

  if (sorted.length === 0) {
    return (
      <EmptyState
        title={rejected ? "Aucun rejet — bon travail" : "File vide — beau travail"}
        description={
          rejected
            ? "Aucun produit rejeté en attente de correction."
            : "Aucune soumission en attente. Objectif : revue sous 24 h."
        }
      />
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
              {/* Logo : réel si fourni, sinon tuile initiales */}
              <Link
                href={`/admin/review/${item.id}`}
                className="w-12 h-12 rounded-2xl shrink-0 overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105"
              >
                {item.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className={cn(
                      "flex h-full w-full items-center justify-center text-white font-black text-base bg-linear-to-br",
                      item.iconGradient,
                    )}
                  >
                    {item.initials}
                  </span>
                )}
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
                {rejected && item.rejectionReason && (
                  <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug line-clamp-1">
                    Motif : {item.rejectionReason}
                  </p>
                )}

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
                  {!rejected && exceeded && (
                    <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                      Dépassé
                    </span>
                  )}
                  {rejected && (
                    <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                      Rejeté
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {item.tags.slice(0, 3).map((t) => (
                      <TagPill key={t} label={t} />
                    ))}
                  </span>
                </div>
                {rejected && item.nudgeText && (
                  <p className="text-[11px] font-medium text-muted-foreground">{item.nudgeText}</p>
                )}
              </div>

              {/* Action : Vérifier (revue) ou Rappeler (rejetés, verrou cooldown). */}
              <div className="flex items-center shrink-0 self-center">
                {rejected ? (
                  <button
                    type="button"
                    onClick={() => nudge(item.id)}
                    disabled={!onNudge || nudging !== null || item.nudgeDisabled === true}
                    title={
                      item.nudgeDisabled === true
                        ? (item.nudgeText ?? "Rappel déjà envoyé récemment.")
                        : "Envoyer un rappel au maker par email"
                    }
                    className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <BellRingingIcon weight="bold" className="w-4 h-4" />
                    {nudging === item.id ? "Envoi…" : "Rappeler"}
                  </button>
                ) : (
                  <Link
                    href={`/admin/review/${item.id}`}
                    className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
                  >
                    <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                    Vérifier
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
