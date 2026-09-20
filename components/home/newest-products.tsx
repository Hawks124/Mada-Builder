"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CaretUpIcon,
  SealCheckIcon,
  StarIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
} from "@phosphor-icons/react";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { AgeBadge } from "@/components/ui/age-badge";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";

type MockNewest = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  maker: string;
  makerAvatar: string;
  votes: number;
  iconGradient: string;
  initials: string;
  pricing: string;
  rating: string;
  platforms: string[];
  classification: string;
  lifecycle?: string;
};

const MOCK_NEWEST: MockNewest[] = [
  {
    id: "6",
    name: "Fragments Vlog",
    tagline:
      "Record clips all day. Tap once at night for a finished mini-vlog.",
    categoryId: "video",
    maker: "Edison Modesto",
    makerAvatar: "https://i.pravatar.cc/150?u=m6",
    votes: 89,
    iconGradient: "from-rose-400 to-red-500",
    initials: "FV",
    pricing: "freemium",
    rating: "4.9",
    platforms: ["Web", "iOS"],
    classification: "4+",
  },
  {
    id: "7",
    name: "Anong Ulam?",
    tagline: "Ang tanong ng Bayan - Anong Ulam? AI-powered food generator.",
    categoryId: "lifestyle",
    maker: "Arvin",
    makerAvatar: "https://i.pravatar.cc/150?u=m7",
    votes: 54,
    iconGradient: "from-amber-400 to-orange-500",
    initials: "AU",
    pricing: "free",
    rating: "4.5",
    platforms: ["Web"],
    classification: "4+",
  },
  {
    id: "8",
    name: "Attendify",
    tagline: "Simplify Every Event with our smart check-in system.",
    categoryId: "productivity",
    maker: "Iyam",
    makerAvatar: "https://i.pravatar.cc/150?u=m8",
    votes: 42,
    iconGradient: "from-teal-400 to-green-500",
    initials: "AT",
    pricing: "paid",
    rating: "4.8",
    platforms: ["Web", "Android"],
    classification: "12+",
  },
  {
    id: "9",
    name: "SyncDocs",
    tagline: "Real-time document collaboration without the enterprise bloat.",
    categoryId: "dev-tools",
    maker: "Kevin A.",
    makerAvatar: "https://i.pravatar.cc/150?u=m9",
    votes: 31,
    iconGradient: "from-sky-400 to-blue-500",
    initials: "SD",
    pricing: "free",
    rating: "5.0",
    platforms: ["Web", "iOS", "Android"],
    classification: "4+",
    lifecycle: "beta",
  },
  {
    id: "10",
    name: "Lumina UI",
    tagline: "Premium React components built on top of TailwindCSS.",
    categoryId: "design",
    maker: "Sarah Jen",
    makerAvatar: "https://i.pravatar.cc/150?u=m10",
    votes: 27,
    iconGradient: "from-purple-500 to-fuchsia-500",
    initials: "LU",
    pricing: "freemium",
    rating: "4.7",
    platforms: ["Web"],
    classification: "4+",
    lifecycle: "dev",
  },
  {
    id: "11",
    name: "ZenHabits",
    tagline: "Track your habits like a monk. Minimalist tracker.",
    categoryId: "health",
    maker: "Tee Jay",
    makerAvatar: "https://i.pravatar.cc/150?u=m11",
    votes: 18,
    iconGradient: "from-zinc-700 to-zinc-900",
    initials: "ZH",
    pricing: "free",
    rating: "4.9",
    platforms: ["iOS", "Android"],
    classification: "17+",
  },
];

export function NewestProducts() {
  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-16 pb-24">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Fraîchement shippé
          </h2>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-1">
            Découvrez les derniers produits publiés par la communauté.
          </p>
        </div>

        <Link
          href="/products"
          className="group flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          Parcourir tout
          <ArrowRightIcon
            weight="bold"
            className="w-4 h-4 group-hover:translate-x-1 transition-transform"
          />
        </Link>
      </div>

      {/* GHOST CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_NEWEST.map((product) => (
          <div
            key={product.id}
            className="group flex flex-col p-6 rounded-4xl bg-muted/40 hover:bg-muted/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/50 border border-transparent hover:border-border/50 h-full"
          >
            {/* CARD TOP: Icon & Vote */}
            <div className="flex items-start justify-between w-full mb-5">
              {/* Squircle Icon */}
              <div
                className={cn(
                  "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:group-hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]",
                  product.iconGradient,
                )}
              >
                {product.initials}
              </div>

              {/* Vote Up Pill (Zero UI) */}
              <button
                className="flex items-center gap-1.5 px-2 py-1 group/vote hover:bg-muted/50 rounded-md transition-colors"
                onClick={(e) => {
                  e.preventDefault(); // Prevent navigating to product immediately
                  // upvote logic
                }}
              >
                <CaretUpIcon
                  weight="fill"
                  className="w-5 h-5 text-muted-foreground group-hover/vote:text-green-500 transition-colors"
                />
                <span className="text-sm font-black text-foreground group-hover/vote:text-green-600 transition-colors">
                  {product.votes}
                </span>
              </button>
            </div>

            {/* CARD BODY: Content strictly clamped */}
            <div className="flex flex-col gap-1 mb-4 flex-1">
              <Link href={`/products/${product.id}`} className="w-fit">
                <h3 className="text-xl font-extrabold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
              </Link>
              {/* strict height for 2 lines logic (e.g. text-sm leanding-tight is ~1.25rem * 2 = 2.5rem max height) */}
              <p className="text-[14px] leading-snug font-medium text-muted-foreground line-clamp-2 h-11">
                {product.tagline}
              </p>

              {/* New Meta Line: Rating, Platforms, Classification */}
              <div className="flex items-center gap-2.5 mt-3">
                <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                  <StarIcon weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
                  {product.rating}
                </div>
                <div className="w-0.75 h-0.75 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {product.platforms.includes("Web") && <GlobeIcon weight="fill" className="w-3.5 h-3.5 hover:text-foreground transition-colors" />}
                  {product.platforms.includes("iOS") && <AppleLogoIcon weight="fill" className="w-3.5 h-3.5 hover:text-foreground transition-colors" />}
                  {product.platforms.includes("Android") && <AndroidLogoIcon weight="fill" className="w-3.5 h-3.5 hover:text-foreground transition-colors" />}
                </div>
                <div className="w-0.75 h-0.75 rounded-full bg-border" />
                <AgeBadge value={product.classification} size="xs" />

                {product.pricing !== "free" && (
                  <>
                    <div className="w-0.75 h-0.75 rounded-full bg-border" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#B58A43]">
                      Payant
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* CARD FOOTER: Category & Maker */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
              {/* Category + lifecycle exception (silencieux si Lancé) */}
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/categories/${getCategoryById(product.categoryId)!.id}`}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm transition-colors border",
                    getCategoryById(product.categoryId)!.chipClass,
                    getCategoryById(product.categoryId)!.hoverClass
                  )}
                >
                  {getCategoryById(product.categoryId)!.name}
                </Link>
                {product.lifecycle && product.lifecycle !== "live" && (
                  <LifecyclePill lifecycleId={product.lifecycle} />
                )}
              </div>

              {/* Maker Info */}
              <Link
                href={`/makers/${slugifyName(product.maker)}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <img
                  src={product.makerAvatar}
                  alt={product.maker}
                  className="w-5 h-5 rounded-full grayscale group-hover:grayscale-0 transition-opacity"
                />
                <span className="text-[11px] font-bold text-foreground">
                  {product.maker}
                </span>
                <SealCheckIcon
                  weight="fill"
                  className="w-3.5 h-3.5 text-blue-500 -ml-0.5"
                />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
