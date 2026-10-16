"use client";

import * as React from "react";
import { startTransition } from "react";
import Link from "next/link";
import { setFeaturedOverrideAction, setFeaturedOverrideBySlugAction } from "@/app/actions/products";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductAvatarTile } from "@/components/ui/product-avatar";
import { cn } from "@/lib/utils";

/**
 * Produit du jour (staff) : épingle ou rend au palier automatique.
 *
 * Deux actions distinctes et nommées, pas un couple Épingler/Lever côte à
 * côte : « lever » ne dit pas ce qui se passe ensuite. Le message de retour est
 * teinté selon le résultat — sans cela, « Fait. » et « Produit en veille »
 * avaient exactement le même rendu.
 */
export function FeaturedOverrideForm({
  current,
  selected,
}: {
  current: { slug: string; name: string; pinned: boolean } | null;
  /** Produit sous aperçu (`?produit=`), prêt à être épinglé. */
  selected?: { id: string; slug: string; name: string } | null;
}) {
  const [slug, setSlug] = React.useState("");
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string | null }>) => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Fait." : "Échec.") });
      if (res.ok) setSlug("");
      setPending(false);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Aujourd&apos;hui
        </h2>
        {current ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[15px] font-bold">
                <Link href={`/products/${current.slug}`} className="hover:underline">
                  {current.name}
                </Link>
              </span>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/70">
                {current.pinned ? "Choisi par vous" : "Choisi automatiquement"}
              </span>
            </span>
            {current.pinned && (
              <button
                type="button"
                onClick={() => run(() => setFeaturedOverrideAction({ productId: null }))}
                disabled={pending}
                className="shrink-0 rounded-full border border-border/60 px-5 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer disabled:opacity-50"
              >
                Rendre au palier automatique
              </button>
            )}
          </div>
        ) : (
          <EmptyState
            illustration="none"
            size="sm"
            title="Aucun produit désigné."
            description="Le palier automatique s'applique."
          />
        )}
      </section>

      {selected && (
        <section className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium text-muted-foreground">
            <ProductAvatarTile initials="" gradient="from-zinc-500 to-zinc-700" size={28} />
            <span className="truncate">Épingler {selected.name} ?</span>
          </span>
          <button
            type="button"
            onClick={() => run(() => setFeaturedOverrideAction({ productId: selected.id }))}
            disabled={pending}
            className="shrink-0 rounded-full bg-foreground px-5 py-2 text-[13px] font-bold text-background hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {pending ? "…" : "Confirmer"}
          </button>
          <Link
            href="/admin/featured"
            className="shrink-0 rounded-full border border-border/60 px-5 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-border/40 pt-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Ou par slug
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug-du-produit"
            aria-label="Slug du produit à épingler"
            className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-foreground/40 transition-colors"
          />
          <button
            type="button"
            onClick={() => run(() => setFeaturedOverrideBySlugAction({ slug }))}
            disabled={pending || slug.trim() === ""}
            className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "…" : "Épingler"}
          </button>
        </div>
      </section>

      {message !== null && (
        <p
          role="status"
          className={cn(
            "text-[13px] font-bold",
            message.ok ? "text-muted-foreground" : "text-red-600 dark:text-red-400",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
