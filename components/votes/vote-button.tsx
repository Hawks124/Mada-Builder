"use client";

import * as React from "react";
import { CaretUpIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useVoteWall } from "@/components/votes/use-vote-wall";
import { formatCompactCount } from "@/components/dashboard/dashboard-mock";

type VoteVariant = "hero" | "row" | "pill";

/**
 * Bouton de vote unifié — le SEUL point d'entrée du vote produit.
 * Mur auth intégré (→ signin?next=) ; toggle local mock en attendant
 * la Server Action du milestone votes (UNIQUE TODO, ici et nulle part
 * ailleurs — fini les 5 implémentations divergentes et les votes fantômes).
 */
export function VoteButton({
  productId,
  productName,
  votes,
  variant,
  className,
}: {
  /** Slug produit — inutilisé jusqu'au milestone votes (action réelle). */
  productId: string;
  productName: string;
  votes: number;
  variant: VoteVariant;
  className?: string;
}) {
  // Référence explicite : le jour du milestone, ce state part dans l'action.
  void productId;
  const [voted, setVoted] = React.useState(false);
  const guardedVote = useVoteWall();

  const count = votes + (voted ? 1 : 0);
  const handleClick = () => {
    // TODO(votes): remplacer par la Server Action toggleVote (optimiste).
    void guardedVote(() => setVoted((v) => !v));
  };

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={voted}
        aria-label={`Voter pour ${productName}`}
        className={cn("flex flex-col items-center gap-1 group cursor-pointer", className)}
      >
        <CaretUpIcon
          weight="fill"
          className={cn(
            "w-7 h-7 group-hover:-translate-y-1 transition-transform duration-200",
            voted ? "text-emerald-500" : "text-green-500",
          )}
        />
        <span
          className={cn(
            "text-[22px] font-black tracking-tighter leading-none tabular-nums",
            voted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {formatCompactCount(count)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {voted ? "Voté" : "votes"}
        </span>
      </button>
    );
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={voted}
        aria-label={`Voter pour ${productName}`}
        className={cn(
          "flex items-center gap-2 px-3 py-2 -mr-3 rounded-full hover:bg-muted transition-colors group/btn cursor-pointer",
          className,
        )}
      >
        <CaretUpIcon
          weight="fill"
          className={cn(
            "w-6 h-6 group-hover/btn:-translate-y-0.5 transition-transform",
            voted ? "text-emerald-500" : "text-green-500",
          )}
        />
        <span
          className={cn(
            "text-xl font-black tracking-tighter tabular-nums",
            voted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {formatCompactCount(count)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={voted}
      aria-label={`Voter pour ${productName}`}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold tabular-nums transition-colors cursor-pointer",
        voted
          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : " text-foreground hover:bg-muted/50",
        className,
      )}
    >
      <CaretUpIcon
        weight="fill"
        className={cn("w-4 h-4", voted ? "text-emerald-500" : "text-muted-foreground")}
      />
      {formatCompactCount(count)}
    </button>
  );
}
