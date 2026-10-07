"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { GridBackground } from "@/components/ui/grid-background";
import { Pagination } from "@/components/ui/pagination";
import { ListLoadingOverlay } from "@/components/ui/list-loading-overlay";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturedProduct } from "@/components/home/featured-product";
import type { FeaturedProductData } from "@/services/home.service";
import { LeaderboardList } from "@/components/ranking/leaderboard-list";
import { RankingFilterBar } from "@/components/ranking/ranking-filter-bar";
import { RANKING_WINDOWS, getWindowLabel, type RankingWindow } from "@/services/home.service";
import { getCategoryById } from "@/config/categories";
import { getProductTypeById } from "@/config/product-types";
import { cn } from "@/lib/utils";
import type { LeaderboardItem } from "@/services/ranking.service";

const TOP_SIZE = 10;
const PAGE_SIZE = 15;

function buildHref(params: {
  w?: string;
  cat?: string | null;
  type?: string | null;
  page?: number;
}) {
  const q = new URLSearchParams();
  if (params.w != null && params.w !== "today") q.set("w", params.w);
  if (params.cat != null) q.set("cat", params.cat);
  if (params.type != null) q.set("type", params.type);
  if (params.page != null && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return `/leaderboard${s !== "" ? `?${s}` : ""}`;
}

/**
 * Coquille classement — données via props (la page serveur charge) :
 * podium chronologique + taxonomique + produit du jour. Seule la
 * navigation reste cliente (`scroll: false` obligatoire : les facettes
 * sont à mi-page, un scroll top ferait perdre le contexte — cf. commentaire
 * historique).
 */
export function LeaderboardContent({
  chrono,
  taxo,
  taxoTotal,
  taxoWeight,
  featured,
  votedIds = [],
  window: w,
  cat,
  type,
  page,
}: {
  chrono: LeaderboardItem[];
  taxo: LeaderboardItem[];
  taxoTotal: number;
  taxoWeight: number;
  featured: FeaturedProductData | null;
  votedIds?: string[];
  window: RankingWindow;
  cat: string | null;
  type: string | null;
  page: number;
}) {
  const router = useRouter();
  const windowLabel = getWindowLabel(w);
  // Voile pendant les navigations facettes (retombe seul au commit).
  const [isNavigating, startNavTransition] = useTransition();
  const go = (href: string) =>
    startNavTransition(() => {
      router.push(href, { scroll: false });
    });

  /* ── Classement 1 : CHRONOLOGIQUE ──────────────────────────────
     Le podium Top 10 EST le classement temporel. `?w=` ne pilote
     que cette section. */
  const podium = chrono.slice(0, TOP_SIZE);

  /* ── Classement 2 : TAXONOMIQUE ───────────────────────────────
     Rang par poids (votes pondérés all-time) sur la sélection
     cat/type. `?w=` ne le contamine pas. */
  const taxoPages = Math.max(1, Math.ceil(taxoTotal / PAGE_SIZE));
  const taxoPage = Math.min(page, taxoPages);
  const taxoStartRank = (taxoPage - 1) * PAGE_SIZE + 1;

  const catName = cat == null ? null : (getCategoryById(cat)?.name ?? null);
  const typeName = type == null ? null : getProductTypeById(type).label;
  const taxoLabel =
    catName != null && typeName != null
      ? `${catName} · ${typeName}`
      : (catName ?? typeName ?? null);

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ── HEADER SEO (H1 fixe : pas d'onglet qui le fait varier) ── */}
      <div className="relative w-full border-b border-border/40">
        <GridBackground variant="css" showBottomFade={false} glowPlacement="centered" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />
        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-8">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Classement de la communauté
          </p>
          <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Le classement de la tech malgache
          </h1>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-2 max-w-2xl">
            Les apps, SaaS et outils construits à Madagascar, classés par les votes de la communauté
            des makers.
          </p>
        </div>
      </div>

      {/* ── PRODUIT DU JOUR ── */}
      {/* Directement sous l'en-tête, **avant** les deux classements. Il était
          en bas de page, après la pagination : sur une page dont tout le sujet
          est le classement, le produit du jour arrivait en dernier, sous une
          liste de 38 pages, et l'utilisateur ne le voyait jamais. PRD §6 :
          « Slot Produit du jour mis en avant en haut ». */}
      <div className="w-full relative border-b border-border/20 pt-12 pb-12">
        {featured ? (
          <FeaturedProduct dense product={featured} />
        ) : (
          <section className="container px-4 md:px-8 max-w-5xl mx-auto w-full">
            <EmptyState
              size="sm"
              title="Aucun produit à mettre en avant — soyez le premier."
              action={
                <Link
                  href="/products/submit"
                  className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Soumettre un produit
                </Link>
              }
            />
          </section>
        )}
      </div>

      {/* ══ CLASSEMENT 1 — CHRONOLOGIQUE ══ */}
      <div className="w-full relative border-b border-border/20">
        <section className="relative container px-4 md:px-8 max-w-5xl mx-auto w-full pt-12 pb-12">
          <ListLoadingOverlay active={isNavigating} />
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Classement chronologique
              </p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-foreground leading-none">
                Top 10 · {windowLabel}
              </h2>
              <p className="text-muted-foreground font-medium tracking-tight mt-1">
                Ce qui monte en ce moment, tous domaines confondus.
              </p>
            </div>
            <div className="inline-flex items-center p-1 bg-muted/50 rounded-full border border-border/40 self-start lg:self-auto overflow-x-auto max-w-full">
              {RANKING_WINDOWS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => go(buildHref({ w: opt.id, cat, type }))}
                  aria-current={w === opt.id ? "page" : undefined}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap cursor-pointer",
                    w === opt.id
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <LeaderboardList
            products={podium}
            votedIds={votedIds}
            startRank={1}
            kickerLabel=""
            emptyTitle={
              w === "today"
                ? "Rien publié aujourd'hui — pour l'instant"
                : w === "week"
                  ? "Semaine calme — pour l'instant"
                  : w === "month"
                    ? "Mois calme — pour l'instant"
                    : "Le classement se remplit"
            }
            emptyDescription={
              w === "today"
                ? "Les produits publiés aujourd'hui apparaîtront ici dès les premiers votes. En attendant, regardez la semaine."
                : "Cette fenêtre est encore vide — les prochains votes et publications la rempliront."
            }
            emptyAction={
              w === "today" ? (
                <Link
                  href={buildHref({ w: "week", cat, type })}
                  className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Voir la semaine
                </Link>
              ) : (
                <Link
                  href="/products/submit"
                  className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Soyez le premier à publier
                </Link>
              )
            }
          />
        </section>
      </div>

      {/* ══ CLASSEMENT 2 — TAXONOMIQUE ══ */}
      <div className="w-full bg-background relative">
        <section className="relative container px-4 md:px-8 max-w-5xl mx-auto w-full pt-12 pb-12">
          <ListLoadingOverlay active={isNavigating} />
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Classement par domaine
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-foreground leading-none">
              {taxoLabel ?? "Le poids de chaque domaine"}
            </h2>
            <p className="text-muted-foreground font-medium tracking-tight">
              {taxoLabel != null
                ? `${taxoWeight.toLocaleString("fr-FR")} votes cumulés dans cette sélection.`
                : "Le catalogue entier, classé par poids — hors chronologie. Choisissez un domaine pour le narmer."}
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 mb-8">
            <RankingFilterBar
              selectedCat={cat}
              onCatChange={(v) => go(buildHref({ w, cat: v, type }))}
              selectedType={type}
              onTypeChange={(v) => go(buildHref({ w, cat, type: v }))}
              resultCount={taxoTotal}
              onReset={() => go(buildHref({ w }))}
            />
          </div>

          <LeaderboardList
            products={taxo}
            votedIds={votedIds}
            startRank={taxoStartRank}
            kickerLabel={taxoLabel != null ? `${taxoLabel} · Par poids` : ""}
            emptyAction={
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => go(buildHref({ w }))}
                  className="h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-bold hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
                <Link
                  href="/discover"
                  className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Explorer l&apos;annuaire
                </Link>
              </div>
            }
          />
          <Pagination
            page={taxoPage}
            totalPages={taxoPages}
            buildHref={(p) => buildHref({ w, cat, type, page: p })}
          />
        </section>
      </div>

      {/* ── CTA bas de page ── */}
      <div className="w-full border-t border-border/20 py-14">
        <div className="container px-4 md:px-8 max-w-5xl mx-auto flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-border/40" />
          <Link
            href="/discover"
            className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Explorer tout l&apos;annuaire
            <ArrowRightIcon
              weight="bold"
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </Link>
          <div className="h-px flex-1 bg-border/40" />
        </div>
      </div>
    </div>
  );
}
