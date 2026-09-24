"use client";

import * as React from "react";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  CaretUpIcon,
  EyeIcon,
  TrashIcon,
  StarIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  FunnelIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TagPill } from "@/components/ui/tag-pill";
import { AgeBadge } from "@/components/ui/age-badge";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { PRODUCT_CATEGORIES, getCategoryById } from "@/config/categories";
import { getRatingById } from "@/config/ratings";
import { formatCompactCount } from "@/components/dashboard/dashboard-mock";
import {
  ADMIN_PRODUCTS,
  PRICING_ORDER,
  type AdminProduct,
} from "@/components/admin/admin-mock";

type SortId = "newest" | "oldest" | "votes" | "pricing";

const SORT_OPTIONS = [
  { id: "newest", label: "Plus récents" },
  { id: "oldest", label: "Plus anciens" },
  { id: "votes", label: "Plus votés" },
  { id: "pricing", label: "Gratuit → payant" },
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <GlobeIcon weight="fill" className="w-3.5 h-3.5" />,
  ios: <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />,
  android: <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5" />,
};

function sortApps(apps: AdminProduct[], sort: SortId): AdminProduct[] {
  const list = [...apps];
  switch (sort) {
    case "oldest":
      return list.sort((a, b) => a.publishedTs - b.publishedTs);
    case "votes":
      return list.sort((a, b) => b.votes - a.votes);
    case "pricing":
      return list.sort(
        (a, b) =>
          (PRICING_ORDER[a.pricing] ?? 99) - (PRICING_ORDER[b.pricing] ?? 99) ||
          b.votes - a.votes,
      );
    case "newest":
    default:
      return list.sort((a, b) => b.publishedTs - a.publishedTs);
  }
}

// Armes lourdes manuelles : suppression produit (non-conformité),
// confirm + détails. Backend : soft delete (deleted_at) + audit.
export function ProductsTable() {
  const [apps, setApps] = React.useState<AdminProduct[]>(ADMIN_PRODUCTS);
  const [query, setQuery] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("all");
  const [sort, setSort] = React.useState<SortId>("newest");
  const [deleteTarget, setDeleteTarget] =
    React.useState<AdminProduct | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = sortApps(
    apps.filter((a) => {
      const matchesQuery =
        normalizedQuery === "" ||
        a.name.toLowerCase().includes(normalizedQuery) ||
        a.tagline.toLowerCase().includes(normalizedQuery) ||
        a.maker.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryId === "all" || a.categoryId === categoryId;
      return matchesQuery && matchesCategory;
    }),
    sort,
  );

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Contrôles réunis — une rangée, zéro scroll */}
      <div className="flex flex-col lg:flex-row gap-3">
        <SearchInput
          variant="page"
          placeholder="Rechercher un produit, un maker…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Select
          value={categoryId}
          onChange={setCategoryId}
          size="sm"
          className="w-full lg:w-48"
          options={[
            { id: "all", label: "Toutes catégories" },
            ...PRODUCT_CATEGORIES.map((c) => ({
              id: c.id,
              label: c.name,
              icon: (
                <c.icon weight="fill" className="w-4 h-4 shrink-0" />
              ),
            })),
          ]}
        />
        <Select
          value={sort}
          onChange={(v) => setSort(v as SortId)}
          size="sm"
          className="w-full lg:w-48"
          icon={
            <FunnelIcon
              weight="fill"
              className="w-4 h-4 text-muted-foreground/60 transition-colors"
            />
          }
          options={SORT_OPTIONS}
        />
      </div>

      {/* Compteur */}
      <div className="flex justify-end -mt-3">
        <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
          {filtered.length} sur {apps.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
          {normalizedQuery !== "" || categoryId !== "all"
            ? "Aucun produit ne correspond."
            : "Aucun produit publié pour le moment."}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((app) => (
            <AdminProductRow
              key={app.id}
              app={app}
              onDelete={() => setDeleteTarget(app)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title={`Supprimer ${deleteTarget?.name ?? ""} ?`}
        description="Le produit disparaît du classement et des fiches. Les votes associés sont conservés pour l'audit."
        details={
          deleteTarget
            ? [
                `${formatCompactCount(deleteTarget.votes)} votes`,
                `${formatCompactCount(deleteTarget.views)} vues cumulées`,
                deleteTarget.revenue
                  ? `MRR ${deleteTarget.revenue.mrrAr.toLocaleString("fr-FR")} Ar déconnecté`
                  : "Aucun revenu connecté",
              ]
            : []
        }
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function AdminProductRow({
  app,
  onDelete,
}: {
  app: AdminProduct;
  onDelete: () => void;
}) {
  const category = getCategoryById(app.categoryId);
  const rating = getRatingById(app.audienceId);

  return (
    <div className="group flex gap-4 py-5 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
      {/* Logo */}
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
            className="text-[15px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
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

        <p className="text-[13px] font-medium text-muted-foreground leading-snug line-clamp-1">
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
            {app.pricing} · {app.productType}
          </span>
        </div>

        {/* Bottom split — tags left, auteur + date right */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 flex-wrap min-w-0">
            {app.tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </span>
          <Link
            href={`/makers/${app.maker.username}`}
            className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <AvatarImage
              src={app.maker.avatarUrl}
              name={app.maker.name}
              size={16}
            />
            <span className="hidden sm:inline">{app.maker.name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{app.launchedAt}</span>
          </Link>
        </div>
      </div>

      {/* Metrics + actions */}
      <div className="flex flex-col items-end justify-center gap-2 shrink-0">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/products/${app.id}`}
            aria-label={`Voir ${app.name}`}
            title="Voir la fiche"
            className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <EyeIcon weight="bold" className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Supprimer ${app.name}`}
            title="Supprimer ce produit"
            className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <TrashIcon weight="bold" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      className="w-0.75 h-0.75 rounded-full bg-border shrink-0"
      aria-hidden="true"
    />
  );
}
