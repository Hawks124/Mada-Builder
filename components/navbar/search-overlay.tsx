"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { AvatarImage } from "@/components/ui/avatar-image";
import { PRODUCT_CATEGORIES } from "@/config/categories";

type SuggestProduct = {
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string | null;
  votes: number;
};

type SuggestMaker = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Overlay de recherche nav (standard command-palette) : la nav ne
 * redirige plus vers Explorer — les résultats s'affichent sur place,
 * groupés (produits, makers, catégories locales). Clavier complet,
 * Enter = page Explorer, Esc = fermer. Mobile = plein écran.
 */
export function SearchOverlay({
  initialQuery,
  onClose,
}: {
  initialQuery: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Monté frais à chaque ouverture (parent conditionnel) : les useState
  // initiaux suffisent, jamais de resync en effect (règle purity).
  const [q, setQ] = React.useState(initialQuery);
  const [products, setProducts] = React.useState<SuggestProduct[]>([]);
  const [makers, setMakers] = React.useState<SuggestMaker[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Portail body (SSR-safe via useMounted) : monté dans le header
  // (backdrop-blur), un `fixed` non portailé se calerait sur 72 px —
  // panneau rogné + nav devant (contexte d'empilement). Portail = viewport.
  const mounted = useMounted();

  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "unset";
    };
  }, []);

  React.useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { products: SuggestProduct[]; makers: SuggestMaker[] };
        setProducts(data.products ?? []);
        setMakers(data.makers ?? []);
        setActive(0);
      } catch {
        /* abort ou réseau — silence, la page Explorer reste l'issue */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const queryActive = q.trim().length >= 2;
  // Requête raccourcie sous 2 lettres : on masque les résultats périmés
  // (état conservé, pas de resync — règle purity).
  const shownProducts = queryActive ? products : [];
  const shownMakers = queryActive ? makers : [];
  const clean = q.trim().toLowerCase();
  const categories =
    clean.length >= 2
      ? PRODUCT_CATEGORIES.filter(
          (c) => c.name.toLowerCase().includes(clean) || c.id.includes(clean.replace(/\s+/g, "-")),
        ).slice(0, 3)
      : [];

  type Row =
    | { kind: "product"; key: string; href: string }
    | { kind: "maker"; key: string; href: string }
    | { kind: "category"; key: string; href: string };
  const rows: Row[] = [
    ...shownProducts.map((p): Row => ({
      kind: "product",
      key: `p:${p.slug}`,
      href: `/products/${p.slug}`,
    })),
    ...shownMakers.map((m): Row => ({
      kind: "maker",
      key: `m:${m.username}`,
      href: `/makers/${m.username}`,
    })),
    ...categories.map((c): Row => ({
      kind: "category",
      key: `c:${c.id}`,
      href: `/categories/${c.id}`,
    })),
  ];

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (rows.length > 0 ? (a + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (rows.length > 0 ? (a - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = rows[active];
      if (target) go(target.href);
      else if (q.trim() !== "") go(`/discover?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const hasResults = rows.length > 0;
  const showEmpty = !loading && q.trim().length >= 2 && !hasResults;

  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6 sm:pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full h-full sm:h-auto sm:max-h-[70vh] sm:max-w-lg rounded-none sm:rounded-2xl border-0 sm:border border-border/60 bg-background shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border/40 shrink-0">
          <MagnifyingGlassIcon weight="bold" className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher produits, makers, catégories…"
            aria-label="Rechercher"
            className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          {loading && (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Esc
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && !hasResults && (
            <div className="flex flex-col gap-1 p-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="h-8 w-8 rounded-full bg-muted/70 animate-pulse shrink-0" />
                  <span className="flex flex-col gap-1.5 flex-1">
                    <span className="h-3.5 w-2/5 rounded bg-muted/70 animate-pulse" />
                    <span className="h-3 w-3/5 rounded bg-muted/50 animate-pulse" />
                  </span>
                </div>
              ))}
            </div>
          )}
          {shownProducts.length > 0 && (
            <div className="flex flex-col">
              <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Produits
              </p>
              {shownProducts.map((p) => {
                const idx = rows.findIndex((r) => r.key === `p:${p.slug}`);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => go(`/products/${p.slug}`)}
                    onMouseEnter={() => setActive(idx)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active === idx ? "bg-muted/70" : "bg-transparent",
                    )}
                  >
                    <AvatarImage src={p.iconUrl} name={p.name} size={32} />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-bold text-foreground truncate">
                        {p.name}
                      </span>
                      <span className="text-[12px] font-medium text-muted-foreground truncate">
                        {p.tagline}
                      </span>
                    </span>
                    <span className="text-[12px] font-black text-muted-foreground tabular-nums shrink-0">
                      {p.votes}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {shownMakers.length > 0 && (
            <div className="flex flex-col">
              <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Makers
              </p>
              {shownMakers.map((m) => {
                const idx = rows.findIndex((r) => r.key === `m:${m.username}`);
                return (
                  <button
                    key={m.username}
                    type="button"
                    onClick={() => go(`/makers/${m.username}`)}
                    onMouseEnter={() => setActive(idx)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active === idx ? "bg-muted/70" : "bg-transparent",
                    )}
                  >
                    <AvatarImage src={m.avatarUrl} name={m.displayName} size={32} />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-bold text-foreground truncate">
                        {m.displayName}
                      </span>
                      <span className="text-[12px] font-medium text-muted-foreground truncate">
                        @{m.username}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {categories.length > 0 && (
            <div className="flex flex-col">
              <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Catégories
              </p>
              {categories.map((c) => {
                const idx = rows.findIndex((r) => r.key === `c:${c.id}`);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go(`/categories/${c.id}`)}
                    onMouseEnter={() => setActive(idx)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active === idx ? "bg-muted/70" : "bg-transparent",
                    )}
                  >
                    <span className="text-[14px] font-bold text-foreground truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {showEmpty && (
            <p className="px-5 py-8 text-center text-[14px] font-medium text-muted-foreground">
              Aucun résultat pour « {q.trim()} ».
            </p>
          )}
          {!loading && q.trim().length < 2 && (
            <p className="px-5 py-8 text-center text-[13px] font-medium text-muted-foreground">
              Tapez au moins 2 lettres — produits, makers et catégories.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border/40">
          <Link
            href={`/discover?q=${encodeURIComponent(q.trim())}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-5 h-12 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Voir tous les résultats dans Explorer
            <ArrowRightIcon weight="bold" className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
