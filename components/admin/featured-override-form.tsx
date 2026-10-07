"use client";

import * as React from "react";
import { startTransition } from "react";
import Link from "next/link";
import { setFeaturedOverrideAction, setFeaturedOverrideBySlugAction } from "@/app/actions/products";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Override produit du jour (staff) : épingle un slug publié aujourd'hui
 * ou lève l'épingle (le palier reprend la main). L'état affiché vient du
 * serveur (props) ; l'action revalide `/` (hero à jour).
 */
export function FeaturedOverrideForm({
  current,
}: {
  current: { slug: string; name: string; pinned: boolean } | null;
}) {
  const [slug, setSlug] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string | null }>) => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setMessage(res.message ?? (res.ok ? "Fait." : "Échec."));
      if (res.ok) setSlug("");
      setPending(false);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/20 px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Produit du jour — override
        </h2>
        {current ? (
          <p className="text-[13px] font-medium text-muted-foreground">
            Aujourd&apos;hui :{" "}
            <Link
              href={`/products/${current.slug}`}
              className="font-bold text-foreground hover:underline"
            >
              {current.name}
            </Link>{" "}
            {current.pinned && (
              <span className="ml-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Épinglé
              </span>
            )}
          </p>
        ) : (
          <EmptyState
            illustration="none"
            size="sm"
            title="Aucun produit désigné."
            description="Le palier automatique s'applique."
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug-du-produit"
          aria-label="Slug du produit à épingler"
          className="flex-1 min-w-0 bg-background border border-border/60 rounded-xl px-4 py-2.5 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          type="button"
          onClick={() => run(() => setFeaturedOverrideBySlugAction({ slug }))}
          disabled={pending || slug.trim() === ""}
          className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "…" : "Épingler"}
        </button>
        {current && (
          <button
            type="button"
            onClick={() => run(() => setFeaturedOverrideAction({ productId: null }))}
            disabled={pending}
            className="shrink-0 rounded-full border border-border/60 px-5 py-2.5 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            Lever
          </button>
        )}
      </div>
      {message !== null && (
        <p role="status" className="text-[12px] font-bold text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
