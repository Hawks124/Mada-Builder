"use client";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ChatCircleTextIcon, SealCheckIcon, TrendUpIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { VoteButton } from "@/components/votes/vote-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { LeaderboardItem } from "@/services/ranking.service";

interface LeaderboardListProps {
  products: LeaderboardItem[];
  /** UUIDs votés par l'auteur (badges initiaux, 1 requête en page). */
  votedIds?: string[];
  /** Rang de la première ligne (offset pagination : page 2 → 16). */
  startRank?: number;
  /** Contexte du tri pour le kicker (ex. "Les + votés · Ce mois"). */
  kickerLabel?: string;
  /** Actions de l'empty state (le parent's → l'UI reste dumb). */
  emptyAction?: React.ReactNode;
  /** Empty state contextuel (fenêtre/filtre) — défauts génériques. */
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Médailles 1-3 (mêmes tokens que partout), 4+ neutre. */
function rankColor(rank: number): string {
  if (rank === 1) return "text-amber-500 dark:text-amber-400 drop-shadow-sm";
  if (rank === 2) return "text-zinc-400 dark:text-zinc-300 drop-shadow-sm";
  if (rank === 3) return "text-orange-700 dark:text-orange-600 drop-shadow-sm";
  return "text-muted-foreground/30";
}

/**
 * Lignes leaderboard — présentation pure, données via props.
 *
 * Ordre de lecture : rang → nom → tagline → chips. Le nom est l'élément
 * le plus important, il ne doit pas être enterré sous trois lignes de
 * métadonnées. Séparation par le whitespace seul (DESIGN.md §4) : pas de
 * bordure au hover.
 */
export function LeaderboardList({
  products,
  votedIds = [],
  startRank = 1,
  kickerLabel = "Les + votés",
  emptyAction,
  emptyTitle = "Aucun produit ici pour le moment",
  emptyDescription = "Cette sélection est encore vide — les prochains votes la rempliront.",
}: LeaderboardListProps) {
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="flex flex-col gap-1">
      {products.map((product, i) => {
        const rank = startRank + i;
        const category = getCategoryById(product.categoryId);
        const voted = votedIds.includes(product.id);
        return (
          <div
            key={product.id}
            className="group relative flex items-center gap-4 md:gap-6 py-5 rounded-3xl hover:bg-muted/30 transition-colors"
          >
            {/* RANG — seule occurrence du rang (médailles 1-3) */}
            <div className="w-8 md:w-12 shrink-0 flex justify-center">
              <span
                className={cn(
                  "text-3xl font-extrabold tracking-tighter transition-colors tabular-nums",
                  rankColor(rank),
                )}
              >
                {rank}
              </span>
            </div>

            {/* ICON */}
            <Link
              href={`/products/${product.slug}`}
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                product.iconGradient,
              )}
            >
              {product.initials}
            </Link>

            {/* INFOS — nom, tagline, chips sur une ligne basse. Kicker
                optionnel : masqué si le titre de section porte déjà le
                contexte (évite 25 lignes de texte redondant). */}
            <div className="flex flex-col flex-1 min-w-0">
              {kickerLabel !== "" && (
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
                  {kickerLabel}
                </span>
              )}

              <Link href={`/products/${product.slug}`} className="group/title w-fit max-w-full">
                <h4 className="text-lg md:text-xl font-extrabold tracking-tight text-foreground group-hover/title:text-primary transition-colors truncate">
                  {product.name}
                </h4>
              </Link>

              <p className="text-[13px] md:text-sm font-medium text-muted-foreground truncate max-w-lg">
                {product.tagline}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                {category && (
                  <Link
                    href={`/categories/${category.id}`}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm transition-colors cursor-pointer",
                      category.chipClass,
                      category.hoverClass,
                    )}
                  >
                    {category.name}
                  </Link>
                )}

                {product.pricingId !== "free" && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#B58A43]">
                    {product.pricingId === "paid" ? "Payant" : "Freemium"}
                  </span>
                )}

                <Link
                  href={`/makers/${product.makerUsername}`}
                  className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AvatarImage
                    src={product.makerAvatarUrl}
                    name={product.makerDisplayName}
                    size={16}
                    className="grayscale group-hover:grayscale-0 transition-all"
                  />
                  {product.makerDisplayName}
                  <SealCheckIcon weight="fill" className="w-3.5 h-3.5 text-blue-500" />
                </Link>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-4 md:gap-6 shrink-0">
              <div className="hidden md:flex flex-col items-center gap-0.5 text-muted-foreground">
                <ChatCircleTextIcon weight="fill" className="w-5 h-5" />
                <span className="text-[11px] font-bold leading-none tabular-nums">0</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Vélocité : signal le plus « vendeur » pour un maker, donc
                    visible même sur mobile (40px). */}
                <span
                  className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                  aria-label={`${product.dailyVotes} votes aujourd'hui`}
                  title="Votes ajoutés aujourd'hui"
                >
                  <TrendUpIcon weight="bold" className="w-3 h-3" />
                  {product.dailyVotes}
                </span>

                <div className="hidden md:block">
                  <VoteButton
                    productId={product.id}
                    productName={product.name}
                    votes={product.votes}
                    initialVoted={voted}
                    variant="row"
                  />
                </div>
                <div className="md:hidden">
                  <VoteButton
                    productId={product.id}
                    productName={product.name}
                    votes={product.votes}
                    initialVoted={voted}
                    variant="pill"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
