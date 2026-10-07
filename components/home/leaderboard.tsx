"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { LeaderboardList } from "@/components/ranking/leaderboard-list";
import type { LeaderboardItem } from "@/services/ranking.service";
import type { RankingWindow } from "@/services/home.service";
import { getWindowLabel } from "@/services/home.service";

const WINDOW_LINKS: Record<RankingWindow, string> = {
  today: "/leaderboard",
  week: "/leaderboard?w=week",
  month: "/leaderboard?w=month",
  all: "/leaderboard?w=all",
};

/**
 * Teaser home — top 5 de la première fenêtre non vide + CTA vers
 * /leaderboard (page classement complète). PAS de filtres ici : des
 * onglets qui naviguent ressemblaient à des filtres et affichaient du
 * vide — la home montre du contenu ou rien.
 */
export function Leaderboard({
  items,
  totalVotes,
  votedIds = [],
  limit = 5,
  boardWindow,
}: {
  items: LeaderboardItem[];
  totalVotes: number;
  votedIds?: string[];
  limit?: number;
  boardWindow: RankingWindow;
}) {
  const windowLabel = getWindowLabel(boardWindow);
  return (
    <section className="container px-4 md:px-8 max-w-5xl mx-auto w-full pt-16 pb-24">
      {/* HEADER & CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Classement de la communauté · {windowLabel}
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-foreground">
            {totalVotes.toLocaleString("fr-FR")} votes au total
          </h3>
        </div>

        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors self-start md:self-auto"
        >
          Voir le classement
          <ArrowRightIcon weight="bold" className="h-4 w-4" />
        </Link>
      </div>

      {/* LISTING (teaser) */}
      <LeaderboardList
        products={items.slice(0, limit)}
        votedIds={votedIds}
        startRank={1}
        kickerLabel=""
        emptyTitle="Le classement se remplit"
        emptyDescription="Aucun produit publié pour le moment — soyez le premier, et cette section s'animera."
        emptyAction={
          <Link
            href="/products/submit"
            className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
          >
            Soyez le premier à publier
          </Link>
        }
      />

      {items.length > 0 && (
        <div className="mt-8 text-center md:hidden">
          <Link
            href={WINDOW_LINKS[boardWindow]}
            className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Voir tout le classement · {windowLabel} →
          </Link>
        </div>
      )}
    </section>
  );
}
