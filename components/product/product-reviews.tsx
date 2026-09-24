"use client";
import { StarIcon } from "@phosphor-icons/react";

import { ProductReviewForm } from "./product-review-form";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
export function ProductReviews({ id }: { id?: string }) {
  return (
    <div id={id} className="flex flex-col pt-10 border-t border-border/40">
      <h2 className="text-2xl font-extrabold tracking-tight mb-10">Avis utilisateurs</h2>

      {/* ── ZERO-UI STATS HEADER ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-10 md:gap-20 items-end mb-16 w-full">
        {/* Giant floating number — no card, no box */}
        <div className="flex flex-col gap-0 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Excellence globale
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-[7rem] md:text-[9rem] font-black tracking-tighter leading-none text-foreground -ml-1">
              5.0
            </span>
            <span className="text-2xl font-bold text-muted-foreground/25 mb-2">/&nbsp;5</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} weight="fill" className="w-5 h-5 text-amber-500" />
            ))}
          </div>
        </div>

        {/* Ultra-minimalist 2px distribution bars */}
        <div className="flex flex-col gap-4 w-full flex-1 pb-3">
          {[5, 4, 3, 2, 1].map((stars) => (
            <div key={stars} className="flex items-center gap-5 w-full group">
              <div className="flex items-center gap-1.5 shrink-0 w-7 opacity-35 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-[13px] font-bold text-foreground tabular-nums">{stars}</span>
                <StarIcon weight="fill" className="w-3 h-3 text-amber-500" />
              </div>
              {/* 1.5px razor-thin track */}
              <div className="flex-1 h-[1.5px] bg-border/50 overflow-hidden relative rounded-full">
                <div
                  className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-1000 ease-[cubic-bezier(0.2,1,0.2,1)]"
                  style={{ width: stars === 5 ? "100%" : "0%" }}
                />
              </div>
              <span className="text-[12px] font-bold text-muted-foreground w-4 text-right tabular-nums opacity-35 group-hover:opacity-100 transition-opacity duration-200">
                {stars === 5 ? 1 : 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[13px] font-medium text-muted-foreground mb-10">
        Sur la base de <strong className="text-foreground">1 avis</strong> certifié. Seuls les
        utilisateurs enregistrés peuvent noter ce produit.
      </p>

      {/* ── Leave a Review form (toujours en haut pour la conversion) ── */}
      <ProductReviewForm />

      {/* ── Review list ────────────────────────────────────────── */}
      <div className="flex flex-col gap-10 mt-14">
        {/* ── Single Review item ─────────────────────────────── */}
        <div className="flex flex-col gap-0 group/review">
          {/* Reviewer header + body */}
          <div className="flex items-start gap-4">
            <Link href="/makers/jas" className="shrink-0 hover:opacity-75 transition-opacity">
              <AvatarImage src="https://i.pravatar.cc/150?u=jas" name="Jas Apusaga" size={44} />
            </Link>
            <div className="flex flex-col flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/makers/jas"
                    className="text-[14px] font-bold text-foreground hover:underline leading-tight"
                  >
                    Jas Apusaga
                  </Link>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} weight="fill" className="w-3.5 h-3.5 text-amber-500" />
                    ))}
                  </div>
                </div>
                <span className="text-[12px] font-medium text-muted-foreground shrink-0">
                  Jul 10
                </span>
              </div>
              <p className="text-[15px] text-foreground font-medium mt-3 leading-relaxed">
                idolllllllll! This app completely changed the way I track my expenses. Offline
                capability is unmatched in this space.
              </p>

              {/* Répondre — visible au hover uniquement (maker only) */}
              <div className="mt-3 opacity-0 group-hover/review:opacity-100 transition-opacity duration-200">
                <button className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Répondre
                </button>
              </div>
            </div>
          </div>

          {/* ── RÉPONSE MAKER — design distinct des comments (pas de threading) ── */}
          {/* Style : encadré editorial, signature officielle, pas de fil de discussion */}
          <div className="mt-5 ml-2 md:ml-[60px] flex flex-col gap-4 border-l-[3px] border-amber-500/40 pl-5 md:pl-6">
            {/* Label "Developer Response" */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                Réponse de l&apos;auteur
              </span>
              <div className="h-px flex-1 bg-amber-500/15" />
            </div>

            {/* Author row */}
            <div className="flex items-start gap-3">
              <Link href="/makers/bryl" className="shrink-0 hover:opacity-75 transition-opacity">
                <AvatarImage src="https://i.pravatar.cc/150?u=bryl" name="Bryl Lim" size={32} />
              </Link>
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <Link
                    href="/makers/bryl"
                    className="text-[13px] font-bold text-foreground hover:underline"
                  >
                    Bryl Lim
                  </Link>
                  <span className="text-[11px] font-medium text-muted-foreground">Jul 11</span>
                </div>
                <p className="text-[14px] text-muted-foreground font-medium leading-relaxed mt-2">
                  Thanks for the review Jas! Really appreciate the ongoing support. We&apos;re
                  working on cloud sync v2 next month! Let me know if there&apos;s any specific
                  feature you want.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
