"use client";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ChatCircleTextIcon, SealCheckIcon, StarIcon, TrendUpIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getPlatformById } from "@/config/platforms";
import { getLifecycleById } from "@/config/lifecycle";
import { getRatingById } from "@/config/ratings";
import { AgeBadge } from "@/components/ui/age-badge";
import { VoteButton } from "@/components/votes/vote-button";
import { useFilters, type DiscoverSortId } from "./sidebar-filter";
import type { DiscoverItem } from "@/services/discover.service";

function useOptionalSort(): DiscoverSortId {
  try {
    return useFilters().sortId;
  } catch {
    return "votes";
  }
}

/**
 * Carte catalogue — format dense : l'icône est alignée sur le nom (pas de
 * bloc centré qui repousse le titre vers le bas) et le contenu tient en
 * trois zones. Conteneur `div` + lien overlay : un `<a>` ne contient pas
 * de `<button>`. Données réelles (jamais de chiffres inventés : commentaires
 * et notes à 0/masqués en V1, MRR au lot dédié).
 */
export function DiscoverRowCard({
  product,
  rank,
  voted = false,
}: {
  product: DiscoverItem;
  /** Rang dans la liste affichée — utilisé par le kicker du tri « votes ». */
  rank?: number;
  /** Vote initial de l'auteur (badges, 1 requête en page). */
  voted?: boolean;
}) {
  const category = getCategoryById(product.categoryId);
  const sortId = useOptionalSort();
  const isNew = product.lifecycle !== "live";
  const lifecycle = getLifecycleById(product.lifecycle);
  const rating = getRatingById(product.audienceId);

  // Médailles 1-3 (mêmes tokens que le leaderboard), 4+ neutre.
  const rankColor =
    rank === 1
      ? "text-amber-500 dark:text-amber-400"
      : rank === 2
        ? "text-zinc-400 dark:text-zinc-300"
        : rank === 3
          ? "text-amber-700 dark:text-orange-600"
          : "text-foreground";

  // Kicker : uniquement s'il porte une information que le nom ne dit pas.
  let kicker: React.ReactNode = null;
  if (sortId === "votes" && rank != null) {
    kicker = (
      <>
        <span className={cn(rankColor)}>#{rank}</span> · Les + votés
      </>
    );
  } else if (sortId === "newest" && isNew) {
    kicker = (
      <>
        <span className="text-foreground">Nouveau</span> · Les + récents
      </>
    );
  }

  return (
    <div className="group relative flex flex-col p-5 rounded-[20px] bg-muted/40 hover:bg-muted/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/50 border border-transparent hover:border-border/50 h-full">
      {/* Zone haute : logo + identité + engagement */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3",
            product.iconGradient,
          )}
          aria-hidden="true"
        >
          {product.initials}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {kicker != null && (
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
              {kicker}
            </span>
          )}
          <h3 className="text-lg font-extrabold tracking-tight text-foreground truncate transition-colors group-hover:text-primary">
            {product.name}
          </h3>
          {product.curated && (
            <span
              title="Veille internationale : pas un produit de la scène locale"
              className="self-start rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400"
            >
              Veille
            </span>
          )}
          <p className="text-[13px] leading-snug font-medium text-muted-foreground line-clamp-2">
            {product.tagline}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative z-20">
          <span
            className="flex items-center gap-1 text-muted-foreground"
            aria-label={`${product.commentsCount} commentaires`}
            title="Commentaires"
          >
            <ChatCircleTextIcon weight="fill" className="w-[14px] h-[14px]" />
            <span className="text-[12px] font-bold leading-none tabular-nums">
              {product.commentsCount}
            </span>
          </span>
          <VoteButton
            productId={product.id}
            productName={product.name}
            votes={product.votes}
            initialVoted={voted}
            variant="pill"
            disabledReason={
              product.curated ? "Produit en veille : hors classement, votes désactivés." : undefined
            }
          />
        </div>
      </div>

      {/* Métadonnées */}
      <div className="flex items-center gap-2.5 flex-wrap mt-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {product.platforms.map((id) => {
            const p = getPlatformById(id);
            if (!p) return null;
            const Icon = p.icon;
            return <Icon key={id} weight="fill" className="w-3.5 h-3.5" aria-label={p.label} />;
          })}
        </div>
        <div className="w-0.75 h-0.75 rounded-full bg-border" aria-hidden="true" />

        <AgeBadge value={rating.badge} size="xs" />

        {product.ratingsCount > 0 && (
          <>
            <div className="w-0.75 h-0.75 rounded-full bg-border" aria-hidden="true" />
            <span
              className="flex items-center gap-1 text-[11px] font-bold text-foreground tabular-nums"
              title={`${product.ratingsCount} avis`}
            >
              <StarIcon weight="fill" className="w-3 h-3 text-amber-500" />
              {product.ratingAvg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
            </span>
          </>
        )}

        {product.pricingId !== "free" && (
          <>
            <div className="w-0.75 h-0.75 rounded-full bg-border" aria-hidden="true" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#B58A43]">
              {product.pricingId === "paid" ? "Payant" : "Freemium"}
            </span>
          </>
        )}

        <span
          className={cn(
            "ml-auto flex items-center gap-1 text-[11px] font-bold tabular-nums",
            lifecycle.textClass,
          )}
          title={lifecycle.description}
        >
          <TrendUpIcon weight="bold" className="w-3.5 h-3.5" />+{product.dailyVotes}
          <span className="sr-only">votes aujourd&apos;hui</span>
        </span>
      </div>

      {/* Pied : catégorie + maker */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/20">
        <div className="flex items-center gap-1.5 min-w-0">
          {category && (
            <Link
              href={`/categories/${category.id}`}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border transition-colors relative z-10",
                category.chipClass,
                category.hoverClass,
              )}
            >
              {category.name}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative z-10">
          <AvatarImage
            src={product.makerAvatarUrl}
            name={product.makerDisplayName}
            size={20}
            className="grayscale group-hover:grayscale-0 transition-opacity"
          />
          <span className="text-[11px] font-bold text-foreground">{product.makerDisplayName}</span>
          <SealCheckIcon weight="fill" className="w-3.5 h-3.5 text-blue-500" />
        </div>
      </div>

      {/* Lien overlay : la carte entière est cliquable sans imbriquer d'interactifs */}
      <Link
        href={`/products/${product.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Voir ${product.name}`}
      />
    </div>
  );
}
