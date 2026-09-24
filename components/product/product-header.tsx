"use client";

import { useState } from "react";
import { StarIcon, ChatCircleTextIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { useVoteWall } from "@/components/votes/use-vote-wall";

export function ProductHeader() {
  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Logo + Vote CTA (same row on mobile too) */}
      <div className="flex items-start gap-4 md:gap-6">
        {/* Animated logo */}
        <div className="group w-20 h-20 md:w-28 md:h-28 rounded-3xl bg-linear-to-br from-emerald-400 to-teal-500 shadow-md shrink-0 flex items-center justify-center text-white font-extrabold text-3xl md:text-4xl cursor-pointer transition-all duration-300 hover:scale-105 hover:-rotate-3 hover:shadow-xl dark:hover:shadow-emerald-900/50 relative overflow-hidden">
          <span className="relative z-10 transition-transform duration-300 group-hover:scale-110">
            TA
          </span>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Right of logo: name + tagline + stats */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter leading-none text-foreground">
              Tarsi
            </h1>
            <Link
              href={`/categories/${getCategoryById("finance")!.id}`}
              className={cn(
                "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest mt-1 cursor-pointer transition-all",
                getCategoryById("finance")!.chipClass,
                getCategoryById("finance")!.hoverClass,
              )}
            >
              {getCategoryById("finance")!.name}
            </Link>
          </div>
          <p className="text-base md:text-lg font-medium text-muted-foreground leading-snug max-w-lg">
            Your Personal Finance Companion
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Link href="/makers/bryl" className="flex items-center gap-2 group/maker">
              <AvatarImage
                src="https://i.pravatar.cc/150?u=bryl"
                name="Bryl Lim"
                size={20}
                className="grayscale group-hover/maker:grayscale-0 transition-all"
              />
              <span className="text-sm font-semibold text-foreground group-hover/maker:text-primary transition-colors">
                Bryl Lim
              </span>
            </Link>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1">
              <StarIcon weight="fill" className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-foreground">
                5.0 <span className="text-muted-foreground font-medium text-[13px]">(1)</span>
              </span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <Link
              href="#comments"
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChatCircleTextIcon weight="fill" className="w-4 h-4" />
              <span>4 commentaires</span>
            </Link>
          </div>
        </div>

        {/* Vote button — same row on all screen sizes, compact on mobile */}
        <AnimatedVoteButton />
      </div>
    </div>
  );
}

function AnimatedVoteButton() {
  const [voted, setVoted] = useState(false);
  const guardedVote = useVoteWall();

  return (
    <button
      onClick={() => {
        // TODO(votes): remplacer par la Server Action toggleVote (optimiste).
        void guardedVote(() => setVoted(!voted));
      }}
      className="relative group/vote flex flex-col items-center justify-center w-20 md:w-24 py-4 md:py-5 shrink-0 transition-all outline-none cursor-pointer"
    >
      {/* Soft background that only appears on hover or active */}
      <div
        className={cn(
          "absolute inset-0 rounded-3xl transition-all duration-300 md:duration-500",
          voted
            ? "bg-emerald-500/10 dark:bg-emerald-400/10 scale-100 opacity-100"
            : "bg-muted/0 group-hover/vote:bg-muted/40 group-hover/vote:scale-100 scale-95 opacity-0 group-hover/vote:opacity-100",
        )}
      />

      {/* Ping effect when active */}
      {voted && (
        <span className="absolute inset-0 rounded-3xl animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_1] border-2 border-emerald-500/40 pointer-events-none" />
      )}

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col items-center gap-0.5 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn(
            "w-7 h-7 md:w-8 md:h-8 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            voted
              ? "scale-125 -translate-y-1.5 text-emerald-500 drop-shadow-[0_4px_8px_rgba(16,185,129,0.3)]"
              : "group-hover/vote:-translate-y-1 text-muted-foreground group-hover/vote:text-foreground",
          )}
        >
          <path d="M12 4.5l8.5 13.5H3.5L12 4.5z" />
        </svg>

        <span
          className={cn(
            "text-[20px] md:text-[24px] font-black tracking-tighter leading-none tabular-nums transition-colors mt-0.5",
            voted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {voted ? 312 : 311}
        </span>

        <span
          className={cn(
            "text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-0.5 transition-colors",
            voted
              ? "text-emerald-600 dark:text-emerald-400 opacity-100"
              : "text-muted-foreground opacity-60 group-hover/vote:text-foreground group-hover/vote:opacity-100",
          )}
        >
          {voted ? "Voté" : "Voter"}
        </span>
      </div>
    </button>
  );
}
