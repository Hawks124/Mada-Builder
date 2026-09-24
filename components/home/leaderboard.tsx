"use client";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ChatCircleTextIcon, SealCheckIcon, StarIcon } from "@phosphor-icons/react";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { VoteButton } from "@/components/votes/vote-button";

const MOCK_LEADERBOARD = [
  {
    id: "1",
    rank: 1,
    name: "DateTayo",
    tagline: "Modern Upgrade to Panliligaw!",
    categoryId: "social",
    maker: "Mauries Lopez",
    makerAvatar: "https://i.pravatar.cc/150?u=m1",
    votes: 452,
    dailyVotes: 18,
    comments: 12,
    iconGradient: "from-pink-500 to-rose-500",
    pricing: "free",
    rating: "4.9",
    initials: "DT",
  },
  {
    id: "2",
    rank: 2,
    name: "KadaSplit",
    tagline: "The ultimate barkada expense splitter",
    categoryId: "finance",
    maker: "Lorenz Edward",
    makerAvatar: "https://i.pravatar.cc/150?u=m2",
    votes: 389,
    dailyVotes: 14,
    comments: 9,
    iconGradient: "from-blue-600 to-indigo-600",
    pricing: "freemium",
    rating: "4.8",
    initials: "KS",
  },
  {
    id: "3",
    rank: 3,
    name: "RunScript",
    tagline: "Practice, Solve, Build directly in browser",
    categoryId: "dev-tools",
    maker: "John Benedict",
    makerAvatar: "https://i.pravatar.cc/150?u=m3",
    votes: 312,
    dailyVotes: 9,
    comments: 4,
    iconGradient: "from-emerald-400 to-teal-500",
    pricing: "paid",
    rating: "5.0",
    initials: "RS",
  },
  {
    id: "4",
    rank: 4,
    name: "G-Giel",
    tagline: "Your AI-powered game master",
    categoryId: "entertainment",
    maker: "Francis Tin-ao",
    makerAvatar: "https://i.pravatar.cc/150?u=m4",
    votes: 128,
    dailyVotes: 5,
    comments: 2,
    iconGradient: "from-zinc-700 to-zinc-900",
    pricing: "free",
    rating: "4.5",
    initials: "GG",
  },
  {
    id: "5",
    rank: 5,
    name: "Nala AI",
    tagline: "Local malagasy language model translation",
    categoryId: "ai",
    maker: "Rado Andrian",
    makerAvatar: "https://i.pravatar.cc/150?u=m5",
    votes: 95,
    dailyVotes: 2,
    comments: 15,
    iconGradient: "from-orange-400 to-red-500",
    pricing: "paid",
    rating: "4.7",
    initials: "NA",
  },
];

export function Leaderboard() {
  return (
    <section className="container px-4 md:px-8 max-w-5xl mx-auto w-full pt-16 pb-24">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Classement de la communauté
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-foreground">
            10,278 votes au total
          </h3>
        </div>

        {/* TIME FILTERS (iOS segmented control style) */}
        <div className="inline-flex items-center p-1 bg-muted/50 rounded-full border border-border/40">
          {["Aujourd'hui", "Cette semaine", "Ce mois", "Toujours"].map((label, i) => (
            <button
              key={label}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-bold transition-all",
                i === 0
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTING */}
      <div className="flex flex-col gap-2">
        {MOCK_LEADERBOARD.map((product) => {
          let rankColor = "text-muted-foreground/30";
          if (product.rank === 1) rankColor = "text-amber-500 dark:text-amber-400 drop-shadow-sm";
          if (product.rank === 2) rankColor = "text-zinc-400 dark:text-zinc-300 drop-shadow-sm";
          if (product.rank === 3) rankColor = "text-orange-700 dark:text-orange-600 drop-shadow-sm";

          return (
            <div
              key={product.id}
              className="group relative flex items-center gap-4 md:gap-6 py-5 px-2 md:px-4 rounded-3xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/40"
            >
              {/* RANK */}
              <div className="w-8 md:w-12 shrink-0 flex justify-center">
                <span
                  className={cn(
                    "text-3xl font-extrabold tracking-tighter transition-colors",
                    rankColor,
                  )}
                >
                  {product.rank}
                </span>
              </div>

              {/* ICON */}
              <Link
                href={`/products/${product.id}`}
                className={cn(
                  "w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                  product.iconGradient,
                )}
              >
                {product.initials}
              </Link>

              {/* INFO (Super-title, Name, Tagline) */}
              <div className="flex flex-col flex-1 min-w-0 py-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Link
                    href={`/categories/${getCategoryById(product.categoryId)!.id}`}
                    className={cn(
                      "text-[7px] md:text-[10px] font-black uppercase tracking-widest px-2  rounded-sm transition-colors cursor-pointer ",
                      getCategoryById(product.categoryId)!.chipClass,
                      getCategoryById(product.categoryId)!.hoverClass,
                    )}
                  >
                    {getCategoryById(product.categoryId)!.name}
                  </Link>

                  {/* Pricing Badge */}
                  {product.pricing !== "free" && (
                    <span className="text-[7px] md:text-[10px] font-black uppercase tracking-widest text-[#B58A43] bg-[#B58A43]/10 px-2  rounded-sm">
                      {product.pricing === "paid" ? "Payant" : "Freemium"}
                    </span>
                  )}

                  <Link
                    href={`/makers/${slugifyName(product.maker)}`}
                    className="text-[10px] font-bold text-muted-foreground hidden md:flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <AvatarImage
                      src={product.makerAvatar}
                      name={product.maker}
                      size={16}
                      className="grayscale group-hover:grayscale-0 transition-all"
                    />
                    {product.maker}
                    <SealCheckIcon
                      weight="fill"
                      className="text-blue-500 w-3.5 h-3.5 -ml-0.5 drop-shadow-sm"
                    />
                  </Link>
                </div>
                <Link href={`/products/${product.id}`} className="group/title w-fit">
                  <h4 className="text-lg md:text-xl font-extrabold tracking-tight text-foreground group-hover/title:text-primary transition-colors truncate">
                    {product.name}
                  </h4>
                </Link>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-[13px] md:text-sm font-medium text-muted-foreground truncate max-w-lg">
                    {product.tagline}
                  </p>
                  <div className="hidden md:flex items-center gap-1 text-[11px] font-bold text-foreground">
                    <StarIcon weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
                    {product.rating}
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center gap-4 md:gap-8 shrink-0 pr-2">
                {/* Comments (Hidden on very small screens) */}
                <Link
                  href={`/products/${product.id}#comments`}
                  className="hidden md:flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChatCircleTextIcon weight="fill" className="w-5 h-5" />
                  <span className="text-[11px] font-bold leading-none">{product.comments}</span>
                </Link>

                {/* Upvote Button (Zero UI - Text + Arrow + Daily metric) */}
                <div className="flex items-center md:gap-2">
                  <div
                    className="hidden md:flex items-center justify-center bg-green-500/15 text-green-700 dark:text-green-400 font-bold text-[11px] px-2 py-0.5 rounded-full cursor-help"
                    title="Votes ajoutés aujourd'hui"
                  >
                    +{product.dailyVotes}
                  </div>

                  <VoteButton
                    productId={product.id}
                    productName={product.name}
                    votes={product.votes}
                    variant="row"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
