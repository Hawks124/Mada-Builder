"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrashIcon, ArrowClockwiseIcon, PlugsConnectedIcon } from "@phosphor-icons/react";
import { cn, formatMoney } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SupportedProviders } from "@/components/dashboard/supported-providers";
import { revokeRevenueAction, setRevenueDisplayModeAction } from "@/app/actions/revenue";
import { REVENUE_CONFIG_SPECS } from "@/services/revenue/types";
import type { RevenueProviderId } from "@/services/revenue/types";

export type RevenueProvider = RevenueProviderId;

export type ApiConnection = {
  id: string;
  provider: RevenueProvider;
  productId: string;
  productName: string;
  productSlug: string;
  displayMode: "full" | "badge_only";
  status: "active" | "failing" | "revoked";
  lastSyncedText: string;
  lastError?: string;
  mrrCents: number | null;
  currency: string;
  keyHint: string | null;
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
    inlineClass: "w-7 h-auto",
    darkClass: "dark:brightness-0 dark:invert",
  },
  revenuecat: {
    label: "RevenueCat",
    logo: "/logos/revenuecat.svg",
    inlineClass: "w-4 h-4",
  },
  paddle: {
    label: "Paddle",
    logo: "/logos/paddle.svg",
    inlineClass: "w-4 h-4",
    darkClass: "dark:brightness-0 dark:invert",
  },
  polar: {
    label: "Polar",
    logo: "/logos/polar.svg",
    inlineClass: "w-4 h-4",
  },
  lemon_squeezy: {
    label: "Lemon Squeezy",
    logo: "/logos/lemon-squeezy.svg",
    inlineClass: "w-4 h-4",
    darkClass: "dark:brightness-0 dark:invert",
  },
};

function guideHref(provider: RevenueProvider): string {
  return `/guides/revenus-verifies/${REVENUE_CONFIG_SPECS[provider].guideSlug}#creer-la-cle`;
}

// Connexions réelles (props serveur) : surveiller et révoquer (les secrets
// ne sont jamais ré-affichés). La suppression appelle le serveur (purge
// clé) puis rafraîchit — jamais de suppression locale seule.
export function ApiConnections({ initial = [] }: { initial?: ApiConnection[] }) {
  const router = useRouter();
  const [connections, setConnections] = React.useState<ApiConnection[]>(initial);
  const [deleteTarget, setDeleteTarget] = React.useState<ApiConnection | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const toggleDisplay = async (conn: ApiConnection) => {
    if (togglingId) return;
    setTogglingId(conn.id);
    setDeleteError(null);
    const next = conn.displayMode === "full" ? "badge_only" : "full";
    const res = await setRevenueDisplayModeAction({ connectionId: conn.id, displayMode: next });
    setTogglingId(null);
    if (!res.ok) {
      setDeleteError(res.message ?? "Modification impossible.");
      return;
    }
    setConnections((prev) => prev.map((c) => (c.id === conn.id ? { ...c, displayMode: next } : c)));
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await revokeRevenueAction({ connectionId: deleteTarget.id });
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(res.message ?? "Suppression impossible.");
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    router.refresh();
  };

  const visible = connections.filter((c) => c.status !== "revoked");

  return (
    <div className="flex flex-col gap-12">
      {visible.length === 0 ? (
        <EmptyState
          title="Aucune clé connectée"
          description="Connectez une clé en lecture seule depuis la fiche de votre produit pour afficher vos revenus vérifiés."
          action={
            <Link
              href="/guides/revenus-verifies"
              className="text-[13px] font-bold text-foreground underline underline-offset-4"
            >
              Mode d&apos;emploi →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col">
          {visible.map((conn) => {
            const meta = PROVIDER_META[conn.provider];
            const initials = conn.productName
              .split(/[\s_.-]+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]!.toUpperCase())
              .join("");
            return (
              <div
                key={conn.id}
                className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] items-center gap-x-4 gap-y-1 py-4 px-3 rounded-2xl hover:bg-muted/40 transition-colors"
              >
                {/* Product icon */}
                <Link
                  href={`/products/${conn.productSlug}`}
                  className={cn(
                    "row-span-2 h-11 w-11 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-[15px] bg-linear-to-br from-zinc-500 to-zinc-700 shadow-sm",
                  )}
                >
                  {initials}
                </Link>

                {/* Product + status */}
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <Link
                    href={`/products/${conn.productSlug}`}
                    className="text-[15px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
                  >
                    {conn.productName}
                  </Link>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
                      conn.status === "active"
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
                    )}
                  >
                    <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
                    {conn.status === "active" ? "Active" : "En échec"}
                  </span>
                  {conn.displayMode === "badge_only" && (
                    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-muted-foreground shrink-0">
                      Badge seul
                    </span>
                  )}
                </div>

                {/* MRR */}
                <span
                  className="hidden sm:block row-span-2 text-[15px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                  title={`MRR synchronisé via ${meta.label}`}
                >
                  {conn.mrrCents !== null
                    ? formatMoney(conn.mrrCents, conn.currency, { compact: true })
                    : "—"}
                </span>

                {/* Provider + sync */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground min-w-0">
                    <Image
                      src={meta.logo}
                      alt={meta.label}
                      width={48}
                      height={48}
                      className={cn("object-contain shrink-0", meta.inlineClass, meta.darkClass)}
                    />
                    <span className="truncate">
                      {meta.label} · synchronisé {conn.lastSyncedText}
                      {conn.keyHint ? ` · clé ${conn.keyHint}` : ""}
                    </span>
                    <ArrowClockwiseIcon
                      weight="bold"
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </p>
                  <p className="flex items-center gap-2 text-[12px] font-medium">
                    <button
                      type="button"
                      onClick={() => toggleDisplay(conn)}
                      disabled={togglingId === conn.id}
                      className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {togglingId === conn.id
                        ? "…"
                        : conn.displayMode === "full"
                          ? "Passer en badge seul"
                          : "Publier le chiffre"}
                    </button>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <Link
                      href={guideHref(conn.provider)}
                      className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      Guide {meta.label}
                    </Link>
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
        confirmLabel={deleting ? "Suppression…" : "Supprimer"}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
      {deleteError && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {deleteError}
        </p>
      )}
    </div>
  );
}
