"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { HourglassIcon, ArrowSquareOutIcon, AndroidLogoIcon } from "@phosphor-icons/react";
import type { AdminBuildRow } from "@/services/builds.service";

/** Ligne enrichie côté serveur (jamais d'import service côté client). */
export type BuildTableRow = AdminBuildRow & {
  gradient: string;
  initials: string;
  waitingText: string;
};

type Filter = "all" | "pending" | "approved" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "pending", label: "En revue" },
  { id: "approved", label: "En ligne" },
  { id: "rejected", label: "Rejetés" },
];

function versionLabel(b: AdminBuildRow): string {
  if (b.versionCode === null && !b.versionName) return "sans version";
  return `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

/**
 * Lien par statut (D6) : pending → cockpit revue, ANCRÉ section binaire
 * (la fiche peut déjà être approuvée — flux update — le cockpit a un
 * mode « revue binaire seule », jamais de redirect vers une file vide) ;
 * approved → fiche publique ; rejected → cockpit si la fiche est encore
 * en revue, sinon fiche publique (contexte produit).
 */
function rowHref(b: AdminBuildRow): string {
  if (b.status === "pending") return `/admin/review/${b.productId}#binaire`;
  if (b.status === "approved") return `/products/${b.slug}`;
  return b.productStatus === "pending"
    ? `/admin/review/${b.productId}#binaire`
    : `/products/${b.slug}`;
}

/** Libellé d'action par statut : on ne « vérifie » que le pending —
 *  un build tranché s'ouvre en lecture (« Voir »), jamais en verdict. */
function actionLabel(b: AdminBuildRow): string {
  return b.status === "pending" ? "Vérifier" : "Voir";
}

const PILL: Record<string, string> = {
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
};

const PILL_LABEL: Record<string, string> = {
  pending: "En revue",
  approved: "En ligne",
  rejected: "Rejeté",
};

/**
 * File binaires admin (D6) : MÊME pattern que la file fiches
 * (`ReviewQueue`) + chips de filtre (comme le dashboard produits) —
 * En revue d'abord. AUCUNE action inline : le verdict vit uniquement
 * au cockpit (anti-clic accidentel, même règle que les fiches).
 */
export function BuildsTable({
  builds,
  defaultFilter = "all",
}: {
  builds: BuildTableRow[];
  /** À l'entrée : revue si du pending, sinon tous (choix opérateur). */
  defaultFilter?: Filter;
}) {
  const [filter, setFilter] = React.useState<Filter>(defaultFilter);
  if (builds.length === 0) {
    return (
      <EmptyState
        title="Aucun binaire pour le moment"
        description="Les APK envoyés par les makers apparaîtront ici avec leur statut de revue."
      />
    );
  }
  const counts: Record<Filter, number> = {
    all: builds.length,
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  for (const b of builds) {
    if (b.status === "pending" || b.status === "approved" || b.status === "rejected") {
      counts[b.status] += 1;
    }
  }
  const visible = filter === "all" ? builds : builds.filter((b) => b.status === filter);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-2 flex-wrap"
        role="tablist"
        aria-label="Filtrer par statut"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-bold transition-colors cursor-pointer",
              filter === f.id
                ? "bg-foreground text-background"
                : "border border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
          Rien dans ce statut pour le moment.
        </p>
      ) : (
        <div className="flex flex-col">
          {visible.map((b) => {
            const href = rowHref(b);
            const exceeded = b.status === "pending" && b.waitingHours > 24;
            return (
              <div key={b.id}>
                <div className="group flex gap-4 py-5 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
                  {/* Logo fiche (même repli que partout), sinon initiales */}
                  <Link
                    href={href}
                    className="w-12 h-12 rounded-2xl shrink-0 overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105"
                  >
                    {b.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.iconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className={cn(
                          "flex h-full w-full items-center justify-center text-white font-black text-base bg-linear-to-br",
                          b.gradient,
                        )}
                      >
                        {b.initials}
                      </span>
                    )}
                  </Link>

                  {/* Body */}
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={href}
                        className="text-[16px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
                      >
                        {b.productName}{" "}
                        <span className="font-medium text-muted-foreground">{versionLabel(b)}</span>
                      </Link>
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
                          PILL[b.status] ?? PILL.pending,
                        )}
                      >
                        {PILL_LABEL[b.status] ?? b.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground flex-wrap">
                      <span>
                        par{" "}
                        <Link
                          href={`/makers/${b.makerUsername}`}
                          className="font-bold text-foreground/80 hover:text-foreground transition-colors"
                        >
                          {b.makerDisplayName}
                        </Link>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1" title="Android (APK)">
                        <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{(b.sizeBytes / 1048576).toFixed(1)} Mo</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(b.createdAt)}</span>
                    </div>

                    {b.status === "pending" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-amber-600 dark:text-amber-400">
                          <HourglassIcon weight="fill" className="w-3.5 h-3.5" />
                          {b.waitingText}
                        </span>
                        {exceeded && (
                          <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                            Dépassé
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action : Vérifier (pending) ou Voir (tranché). */}
                  <div className="flex items-center shrink-0 self-center">
                    <Link
                      href={href}
                      className="flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
                    >
                      <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                      {actionLabel(b)}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
