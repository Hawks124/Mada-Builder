"use client";

import * as React from "react";
import { startTransition } from "react";
import Link from "next/link";
import {
  CaretUpIcon,
  EyeIcon,
  CursorClickIcon,
  PencilSimpleIcon,
  TrashIcon,
  HourglassIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
} from "@phosphor-icons/react";
import { cn, formatMoney } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { deleteMyProductAction } from "@/app/actions/products";
import { getLifecycleById } from "@/config/lifecycle";
import {
  STATUS_META,
  formatCompactCount,
  type AppStatus,
  type DashboardApp,
} from "@/components/dashboard/dashboard-mock";

const PAGE_SIZE = 5;

type Filter = "all" | AppStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "live", label: "En ligne" },
  { id: "pending", label: "En revue" },
  { id: "rejected", label: "Rejetées" },
];

const EMPTY_COPY: Record<Filter, { title: string; description: string; cta: boolean }> = {
  all: {
    title: "Aucune application pour le moment.",
    description: "Soumettez votre premier produit et suivez-le ici.",
    cta: true,
  },
  live: {
    title: "Aucune application en ligne pour le moment.",
    description: "Vos produits publiés apparaîtront ici.",
    cta: true,
  },
  pending: {
    title: "Rien en file de revue.",
    description: "Les soumissions en attente de revue apparaîtront ici.",
    cta: false,
  },
  rejected: {
    title: "Aucun rejet — bon travail.",
    description: "Les produits refusés (avec leur motif) apparaîtront ici.",
    cta: false,
  },
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <GlobeIcon weight="fill" className="w-3.5 h-3.5" />,
  ios: <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />,
  android: <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />,
};

// Maker apps — leaderboard-style rows, no cards.
// Per-status rows: live = metrics, pending = elapsed time, rejected = reason.
// Progressive pagination ("Afficher plus"), page size maps 1:1 to LIMIT/OFFSET.
// Delete = Server Action RGPD (irréversible, confirmée) + refresh local.
export function OverviewApps({ apps: initialApps }: { apps: DashboardApp[] }) {
  const [apps, setApps] = React.useState(initialApps);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = React.useState<DashboardApp | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = apps.filter((a) => {
    const matchesStatus = filter === "all" || a.status === filter;
    const matchesQuery =
      normalizedQuery === "" ||
      a.name.toLowerCase().includes(normalizedQuery) ||
      a.tagline.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  const countFor = (f: Filter) =>
    f === "all" ? apps.length : apps.filter((a) => a.status === f).length;

  const selectFilter = (f: Filter) => {
    setFilter(f);
    setVisibleCount(PAGE_SIZE);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const confirmDelete = () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteMyProductAction({ productId: deleteTarget.id });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setDeleteError(res.message ?? "Suppression impossible pour le moment.");
      }
      setDeleting(false);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title + counter + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-black tracking-tight text-foreground">Mes produits</h2>
          <span className="text-[13px] font-medium text-muted-foreground">
            {filtered.length} sur {apps.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            const showCount = f.id === "pending" || f.id === "rejected";
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => selectFilter(f.id)}
                aria-pressed={isActive}
                aria-label={
                  showCount
                    ? `${f.label}, ${countFor(f.id)} application${countFor(f.id) > 1 ? "s" : ""}`
                    : f.label
                }
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition-colors cursor-pointer border",
                  isActive
                    ? "bg-foreground text-background border-transparent font-bold"
                    : "bg-background text-muted-foreground border-border/40 font-medium hover:text-foreground hover:border-border/80",
                )}
              >
                {f.label}
                {showCount && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -top-2 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[10px] font-black tabular-nums leading-none flex items-center justify-center text-white shadow-sm",
                      f.id === "pending" ? "bg-amber-500" : "bg-red-500",
                    )}
                  >
                    {countFor(f.id)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <SearchInput
        variant="page"
        placeholder="Rechercher dans mes applications…"
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
      />

      {/* Rows */}
      {visible.length === 0 ? (
        normalizedQuery !== "" ? (
          <EmptyState
            title={`Aucun résultat pour « ${query.trim()} ».`}
            description="Essayez un autre terme."
          />
        ) : (
          <EmptyState
            title={EMPTY_COPY[filter].title}
            description={EMPTY_COPY[filter].description}
            action={
              EMPTY_COPY[filter].cta ? (
                <Link
                  href="/products/submit"
                  className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Soumettre un produit
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="flex flex-col">
          {visible.map((app) => (
            <AppRow key={app.id} app={app} onDelete={() => setDeleteTarget(app)} />
          ))}
        </div>
      )}

      {/* Progressive pagination */}
      {remaining > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-full border border-border/60 bg-background px-6 py-2.5 text-[14px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            Afficher plus ({remaining} restante{remaining > 1 ? "s" : ""})
          </button>
          <span className="text-[12px] font-medium text-muted-foreground">
            Affichage {visible.length} sur {filtered.length}
          </span>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title={`Supprimer ${deleteTarget?.name ?? ""} ?`}
        description={
          <>
            Cette application, ses votes et ses statistiques seront définitivement perdus. Cette
            action est irréversible.
            {deleteError !== null && (
              <span role="alert" className="block mt-2 font-bold text-red-600 dark:text-red-400">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Supprimer"
        confirmPending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

function AppPlatforms({ app }: { app: DashboardApp }) {
  const lifecycle = getLifecycleById(app.lifecycle);
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="flex items-center gap-1">
        {app.platforms.map((p) => (
          <span key={p} title={p}>
            {PLATFORM_ICONS[p]}
          </span>
        ))}
      </span>
      <span aria-hidden="true">·</span>
      <span className="text-[11px] font-semibold">{app.productType}</span>
      <span aria-hidden="true">·</span>
      <span className={cn("text-[11px] font-bold", lifecycle.textClass)}>{lifecycle.label}</span>
    </span>
  );
}

function EditButton({ appId, appName }: { appId: string; appName: string }) {
  return (
    <Link
      href={`/products/submit?edit=${appId}`}
      aria-label={`Modifier ${appName}`}
      className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors"
    >
      <PencilSimpleIcon weight="bold" className="w-3.5 h-3.5" />
      <span className="hidden md:inline">Éditer</span>
    </Link>
  );
}

function DeleteButton({ appName, onDelete }: { appName: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Supprimer ${appName}`}
      title="Supprimer"
      className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
    >
      <TrashIcon weight="bold" className="h-4 w-4" />
    </button>
  );
}

/**
 * Icône produit : logo R2 si fourni (avec repli si l'image casse),
 * sinon tuile gradient + initiales (design historique inchangé).
 */
function AppIcon({
  iconUrl,
  initials,
  gradient,
}: {
  iconUrl?: string | null;
  initials: string;
  gradient: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (iconUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center text-white font-black text-[15px] bg-linear-to-br",
        gradient,
      )}
    >
      {initials}
    </span>
  );
}

function AppRow({ app, onDelete }: { app: DashboardApp; onDelete: () => void }) {
  const status = STATUS_META[app.status];

  return (
    <div className="flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
      {/* Icon : logo réel si fourni, sinon tuile initiales (design inchangé) */}
      <Link
        href={`/products/${app.id}`}
        className="w-11 h-11 rounded-2xl shrink-0 overflow-hidden shadow-sm"
        aria-label={`Voir ${app.name}`}
      >
        <AppIcon iconUrl={app.iconUrl} initials={app.initials} gradient={app.iconGradient} />
      </Link>

      {/* Name + tagline + platform/type + status extras */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href={`/products/${app.id}`}
            className="text-[15px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
          >
            {app.name}
          </Link>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
              status.pillClass,
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="text-[13px] font-medium text-muted-foreground truncate">{app.tagline}</p>
        <AppPlatforms app={app} />
        {app.status === "rejected" && app.rejectionReason && (
          <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug">
            Motif : {app.rejectionReason}
          </p>
        )}
      </div>

      {/* Right block per status */}
      {app.status === "live" && (
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <span
            className="flex items-center gap-1 text-[13px] font-bold text-foreground tabular-nums"
            title="Upvotes"
          >
            <CaretUpIcon weight="fill" className="w-4 h-4 text-muted-foreground" />
            {formatCompactCount(app.votes)}
          </span>
          <span
            className="flex items-center gap-1 text-[13px] font-bold text-foreground tabular-nums"
            title="Vues fiche"
          >
            <EyeIcon weight="bold" className="w-4 h-4 text-muted-foreground" />
            {formatCompactCount(app.views)}
          </span>
          <span
            className="flex items-center gap-1 text-[13px] font-bold text-foreground tabular-nums"
            title="Clics sortants"
          >
            <CursorClickIcon weight="bold" className="w-4 h-4 text-muted-foreground" />
            {formatCompactCount(app.clicks)}
          </span>
          {app.views > 0 && (
            <span
              className="text-[11px] font-bold text-muted-foreground tabular-nums"
              title="Taux de clic (clics / vues)"
            >
              {Math.round((app.clicks / app.views) * 100)} %
            </span>
          )}
          {app.topRank !== undefined && (
            <span
              className="flex items-center gap-1 text-[13px] font-black text-amber-600 dark:text-amber-400 tabular-nums"
              title="Position au classement tout le temps"
            >
              #{app.topRank}
            </span>
          )}
          {app.revenue && (
            <span
              className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
              title={`Revenus vérifiés via ${app.revenue.provider}`}
            >
              {formatMoney(app.revenue.mrrCents, "USD", { compact: true })}
            </span>
          )}
        </div>
      )}

      {app.status === "pending" && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-amber-600 dark:text-amber-400">
            <HourglassIcon weight="fill" className="w-4 h-4" />
            {app.waitingText ?? "En revue"}
          </span>
          {app.notifStatus && (
            <span
              className={
                app.notifStatus === "ok"
                  ? "text-[11px] font-bold text-muted-foreground"
                  : "text-[11px] font-bold text-red-600 dark:text-red-400"
              }
              title={
                app.notifStatus === "ok"
                  ? "Email de statut envoyé"
                  : "Email de statut en échec — contactez la revue"
              }
            >
              {app.notifStatus === "ok" ? "Notifié par email" : "Échec notif email"}
            </span>
          )}
          <button
            type="button"
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors cursor-pointer"
          >
            Contacter la revue
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {app.status !== "pending" && <EditButton appId={app.id} appName={app.name} />}
        <DeleteButton appName={app.name} onDelete={onDelete} />
      </div>
    </div>
  );
}
