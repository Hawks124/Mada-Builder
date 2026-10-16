"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminProductsList } from "@/app/actions/products";
import { SearchInput } from "@/components/ui/search-input";
import { ProductAvatarTile } from "@/components/ui/product-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type PickerRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  iconUrl?: string | null;
  initials: string;
  gradient: string;
};

/**
 * Sélecteur de produit pinnable : page serveur + « Charger plus » keyset,
 * jamais d'OFFSET (convention admin, cf. `users-table`).
 *
 * La recherche part dans l'URL (`?q=`), donc le rendu reste serveur et la
 * page est partageable. Cliquer une ligne ouvre l'aperçu (`?produit=`) sans
 * état client.
 */
export function FeaturedPicker({
  initial,
  nextCursor,
  q,
  selectedId,
}: {
  initial: PickerRow[];
  nextCursor: string | null;
  q: string;
  selectedId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [cursor, setCursor] = React.useState(nextCursor);
  const [query, setQuery] = React.useState(q);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Nouvelle page serveur : on repart de ses données, pas de l'accumulé.
  const pageKey = `${q}|${nextCursor ?? ""}`;
  const [seenKey, setSeenKey] = React.useState(pageKey);
  if (seenKey !== pageKey) {
    setSeenKey(pageKey);
    setRows(initial);
    setCursor(nextCursor);
    setQuery(q);
  }

  // Recherche dans l'URL après un temps d'arrêt : `onChange` est un handler
  // DOM, pousser à chaque frappe relancerait une requête par lettre.
  React.useEffect(() => {
    if (query === q) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim() !== "") params.set("q", query.trim());
      router.push(`/admin/featured?${params.toString()}`);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, q, router]);

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    React.startTransition(async () => {
      const result = await getAdminProductsList({
        q,
        status: "published",
        curated: false,
        cursor,
      });
      setLoadingMore(false);
      setRows((prev) => {
        const known = new Set(prev.map((r) => r.id));
        return [...prev, ...result.items.filter((r) => !known.has(r.id))];
      });
      setCursor(result.nextCursor);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        variant="page"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un produit pinnable"
      />

      {rows.length === 0 ? (
        <EmptyState
          illustration="none"
          size="sm"
          title={
            q.trim() !== ""
              ? `Aucun produit pinnable pour « ${q.trim()} »`
              : "Aucun produit pinnable."
          }
          description="Seuls les produits publiés et hors veille peuvent être mis en avant."
        />
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const active = row.id === selectedId;
            return (
              <li key={row.id} className="border-t border-border/40">
                <Link
                  href={`/admin/featured?produit=${row.id}`}
                  className={cn(
                    "flex items-center gap-3 py-3 transition-colors",
                    active ? "text-foreground" : "hover:bg-muted/30",
                  )}
                >
                  <ProductAvatarTile
                    iconUrl={row.iconUrl}
                    initials={row.initials}
                    gradient={row.gradient}
                    size={36}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-bold text-foreground">
                      {row.name}
                    </span>
                    <span className="truncate text-[12px] font-medium text-muted-foreground">
                      {row.tagline}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-black uppercase tracking-[0.12em]",
                      active ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {active ? "Sélectionné" : "Aperçu"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="inline-flex items-center gap-2 self-start rounded-full border border-border/60 px-6 py-2.5 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loadingMore && <Spinner size="xs" />}
          {loadingMore ? "Chargement." : "Charger plus"}
        </button>
      )}
    </div>
  );
}
