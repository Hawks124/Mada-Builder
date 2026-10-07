"use client";

import * as React from "react";
import { startTransition, useOptimistic, useState } from "react";
import { CaretUpIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useVoteWall } from "@/components/votes/use-vote-wall";
import { toggleVoteAction } from "@/app/actions/products";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { formatCompactCount } from "@/components/dashboard/dashboard-mock";

type VoteVariant = "hero" | "row" | "pill";

/**
 * Bouton de vote unifié — le SEUL point d'entrée du vote produit.
 * Mur auth intégré (→ signin?next= + vote en attente rejoué au retour) ;
 * toggle optimiste réconcilié sur la réponse serveur (compteur exact,
 * jamais de dérive locale). Erreur serveur = retour à l'état confirmé +
 * toast (jamais de vote fantôme).
 */
export function VoteButton({
  productId,
  productName,
  votes,
  initialVoted = false,
  variant,
  className,
  disabledReason,
}: {
  /** UUID produit (slug uniquement pour les liens, jamais ici). */
  productId: string;
  productName: string;
  votes: number;
  initialVoted?: boolean;
  variant: VoteVariant;
  className?: string;
  /** Veille : vote désactivé avec motif explicite (jamais silencieux). */
  disabledReason?: string;
}) {
  const [confirmed, setConfirmed] = useState({ voted: initialVoted, count: votes });
  const [optimistic, setOptimistic] = useOptimistic(
    confirmed,
    (state: { voted: boolean; count: number }, nextVoted: boolean) => ({
      voted: nextVoted,
      count: state.count + (nextVoted ? 1 : -1),
    }),
  );
  const [pending, setPending] = useState(false);
  const [gate, setGate] = useState<"too_young" | "shadowed" | null>(null);
  const guardedVote = useVoteWall(productId);

  const handleClick = () => {
    if (pending) return;
    guardedVote(() => {
      // Tout l'update optimiste VIT dans la transition (React l'exige :
      // setOptimistic hors transition = erreur console + état incohérent).
      const nextVoted = !optimistic.voted;
      setPending(true);
      startTransition(async () => {
        setOptimistic(nextVoted);
        const res = await toggleVoteAction({ productId });
        if (res.ok) {
          setConfirmed({ voted: res.voted, count: res.upvoteCount });
          if (res.voted && !res.counted) {
            // Poids 0 (< 24 h) : dialogue explicatif UNE fois (flag local),
            // puis toast simple. Jamais de harcèlement, jamais de boîte noire.
            let seen = false;
            try {
              seen = localStorage.getItem("vote-gate-seen") === "1";
            } catch {
              seen = true;
            }
            if (!seen) {
              setGate("shadowed");
              try {
                localStorage.setItem("vote-gate-seen", "1");
              } catch {
                // Stockage indisponible : toast de repli ci-dessous.
                setGate(null);
                toast(
                  "info",
                  "Vote enregistré — il comptera au classement avec un compte plus ancien.",
                );
              }
            } else {
              toast(
                "info",
                "Vote enregistré — il comptera au classement avec un compte plus ancien.",
              );
            }
          }
        } else if (res.reason === "account_too_young") {
          // Refus < 1 h : dialogue (pas un toast sec) — le POURQUOI compte.
          setConfirmed((prev) => ({ ...prev }));
          setGate("too_young");
        } else {
          // Retour à l'état confirmé + message (pas de vote fantôme).
          setConfirmed((prev) => ({ ...prev }));
          toast("err", res.message ?? "Vote impossible pour le moment.");
        }
        setPending(false);
      });
    });
  };

  const voted = optimistic.voted;
  const count = optimistic.count;
  const off = disabledReason !== undefined;

  // Notice anti-triche : réutilise le shared dialog en mode informatif
  // (bouton unique). Court et chaleureux — le détail vit dans /regles
  // puis les conditions, jamais dans le dialogue.
  const gateNotice = (
    <ConfirmDialog
      open={gate !== null}
      title={gate === "too_young" ? "Bienvenue ! Encore une petite heure" : "Merci pour ton vote !"}
      description={
        <span>
          {gate === "too_young"
            ? "Ton compte vient de naître — laisse-lui une petite heure, et ton vote comptera. En attendant, explore les fiches !"
            : "Il s'affiche déjà ! Il pèsera au classement quand ton compte aura 24 h — c'est comme ça qu'on garde le jeu équitable pour les makers."}{" "}
          <Link href="/regles" className="font-bold text-foreground underline underline-offset-4">
            Voir les règles du jeu
          </Link>
        </span>
      }
      confirmLabel="J'ai compris"
      hideCancel
      onConfirm={() => setGate(null)}
      onCancel={() => setGate(null)}
    />
  );

  if (variant === "hero") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || off}
          aria-pressed={voted}
          aria-label={off ? disabledReason : `Voter pour ${productName}`}
          title={off ? disabledReason : undefined}
          className={cn(
            "flex flex-col items-center gap-1 group cursor-pointer disabled:cursor-not-allowed",
            off && "opacity-50",
            className,
          )}
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
        {gateNotice}
      </>
    );
  }

  if (variant === "row") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || off}
          aria-pressed={voted}
          aria-label={off ? disabledReason : `Voter pour ${productName}`}
          title={off ? disabledReason : undefined}
          className={cn(
            "flex items-center gap-2 px-3 py-2 -mr-3 rounded-full hover:bg-muted transition-colors group/btn cursor-pointer disabled:cursor-not-allowed",
            off && "opacity-50",
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
        {gateNotice}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || off}
        aria-pressed={voted}
        aria-label={off ? disabledReason : `Voter pour ${productName}`}
        title={off ? disabledReason : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold tabular-nums transition-colors cursor-pointer disabled:cursor-not-allowed",
          off && "opacity-50",
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
      {gateNotice}
    </>
  );
}
