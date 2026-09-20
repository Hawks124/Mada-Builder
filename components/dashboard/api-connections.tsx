"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  KeyIcon,
  TrashIcon,
  ArrowClockwiseIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SupportedProviders } from "@/components/dashboard/supported-providers";
import {
  MOCK_APPS,
  formatCompactAr,
} from "@/components/dashboard/dashboard-mock";

export type RevenueProvider = "stripe" | "revenuecat";

export type ApiConnection = {
  id: string;
  provider: RevenueProvider;
  productId: string;
  productName: string;
  status: "active" | "failing";
  lastSyncedText: string;
  lastError?: string;
  mrrAr: number;
};

const PROVIDER_META: Record<
  RevenueProvider,
  {
    label: string;
    logo: string;
    /** Display size in the sync line (13px text) — aspect per asset. */
    inlineClass: string;
    darkClass?: string;
  }
> = {
  stripe: {
    label: "Stripe",
    logo: "/logos/stripe.svg",
    inlineClass: "w-7",
    darkClass: "dark:brightness-0 dark:invert",
  },
  revenuecat: {
    label: "RevenueCat",
    logo: "/logos/revenuecat.svg",
    inlineClass: "w-4 h-4",
  },
};

const MOCK_CONNECTIONS: ApiConnection[] = [
  {
    id: "conn-avotra-stripe",
    provider: "stripe",
    productId: "avotra-hr",
    productName: "Avotra HR",
    status: "active",
    lastSyncedText: "il y a 2 h",
    mrrAr: 1200000,
  },
  {
    id: "conn-vatsy-rc",
    provider: "revenuecat",
    productId: "vatsy",
    productName: "Vatsy",
    status: "failing",
    lastSyncedText: "il y a 3 j",
    lastError: "Clé révoquée côté RevenueCat",
    mrrAr: 320000,
  },
];

/** Icône produit via jointure mock (→ join products backend). */
function getProductVisual(productId: string): {
  initials: string;
  iconGradient: string;
} {
  const found = MOCK_APPS.find((a) => a.id === productId);
  return {
    initials: found?.initials ?? "••",
    iconGradient: found?.iconGradient ?? "from-zinc-500 to-zinc-700",
  };
}

// Stored keys — surveiller et révoquer (les secrets ne sont jamais
// ré-affichés). Delete via le shared dialog, mock local en attendant la
// server action.
export function ApiConnections() {
  const [connections, setConnections] =
    React.useState<ApiConnection[]>(MOCK_CONNECTIONS);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ApiConnection | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setConnections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-12">
      {connections.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
          <div className="h-14 w-14 rounded-3xl bg-muted/60 flex items-center justify-center">
            <KeyIcon
              weight="duotone"
              className="h-7 w-7 text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Aucune clé connectée
            </h2>
            <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
              Connectez une clé en lecture seule depuis la fiche de votre
              produit pour afficher vos revenus vérifiés.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {connections.map((conn) => {
            const meta = PROVIDER_META[conn.provider];
            const visual = getProductVisual(conn.productId);
            return (
              <div
                key={conn.id}
                className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] items-center gap-x-4 gap-y-1 py-4 px-3 rounded-2xl hover:bg-muted/40 transition-colors"
              >
                {/* Product icon */}
                <Link
                  href={`/products/${conn.productId}`}
                  className={cn(
                    "row-span-2 h-11 w-11 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-[15px] bg-linear-to-br shadow-sm",
                    visual.iconGradient,
                  )}
                >
                  {visual.initials}
                </Link>

                {/* Product + status */}
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <Link
                    href={`/products/${conn.productId}`}
                    className="text-[15px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
                  >
                    {conn.productName}
                  </Link>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
                      conn.status === "active"
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
                    )}
                  >
                    <span
                      className="h-1 w-1 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    {conn.status === "active" ? "Active" : "En échec"}
                  </span>
                </div>

                {/* MRR */}
                <span
                  className="hidden sm:block row-span-2 text-[15px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                  title={`MRR synchronisé via ${meta.label}`}
                >
                  {formatCompactAr(conn.mrrAr)}
                </span>

                {/* Provider + sync */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground min-w-0">
                    <Image
                      src={meta.logo}
                      alt={meta.label}
                      width={48}
                      height={48}
                      className={cn(
                        "object-contain shrink-0",
                        meta.inlineClass,
                        meta.darkClass,
                      )}
                    />
                    <span className="truncate">
                      {meta.label} · synchronisé {conn.lastSyncedText}
                    </span>
                    <ArrowClockwiseIcon
                      weight="bold"
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </p>
                  {conn.status === "failing" && conn.lastError && (
                    <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug">
                      {conn.lastError} — reconnectez depuis la fiche.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="col-start-3 sm:col-start-4 row-start-1 row-span-2 hidden sm:flex items-center gap-1">
              {conn.status === "failing" && (
                <Link
                  href={`/products/submit?edit=${conn.productId}`}
                  className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors whitespace-nowrap"
                >
                      <PlugsConnectedIcon weight="bold" className="w-4 h-4" />
                      Reconnecter
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(conn)}
                    aria-label={`Supprimer la clé ${meta.label} de ${conn.productName}`}
                    title="Supprimer cette clé"
                    className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <TrashIcon weight="bold" className="w-4 h-4" />
                    <span className="hidden xl:inline">Supprimer</span>
                  </button>
                </div>

                {/* Actions — mobile */}
                <div className="col-span-3 flex sm:hidden items-center gap-2 pt-1">
              {conn.status === "failing" && (
                <Link
                  href={`/products/submit?edit=${conn.productId}`}
                  className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-[13px] font-bold text-foreground transition-colors"
                >
                      <PlugsConnectedIcon weight="bold" className="w-4 h-4" />
                      Reconnecter
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(conn)}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-muted-foreground transition-colors"
                  >
                    <TrashIcon weight="bold" className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="w-full h-px bg-border/40" />

      <SupportedProviders connections={connections} />

      {/* Delete confirm — shared dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title={`Supprimer cette clé ?`}
        description={
          deleteTarget
            ? `La synchronisation ${PROVIDER_META[deleteTarget.provider].label} de ${deleteTarget.productName} sera coupée et les snapshots existants conservés.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
