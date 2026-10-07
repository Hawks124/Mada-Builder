"use client";

import { AvatarImage } from "@/components/ui/avatar-image";
import {
  SealCheckIcon,
  StarIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  ChatCircleTextIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getRatingById } from "@/config/ratings";
import { VoteButton } from "@/components/votes/vote-button";
import { AgeBadge } from "@/components/ui/age-badge";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { deriveRevenueView } from "@/components/revenue/revenue-derive";
import { RevenueBadge } from "@/components/revenue/verified-revenue-badge";
import Link from "next/link";

// Extracted from NewestProducts to be used globally (NewestProducts, DiscoverGrid, etc.)
export type ProductCardProps = {
  /** UUID (votes) — les liens utilisent `slug`, jamais l'id. */
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryId: string;
  maker: string;
  makerUsername: string;
  makerAvatar: string | null;
  votes: number;
  initialVoted?: boolean;
  iconGradient: string;
  initials: string;
  /** Id pricing (free|freemium|…) — label affiché : Freemium si non-free. */
  pricing: string;
  /** Note moyenne — vide = bloc masqué (avis en V1.5, jamais de faux chiffre). */
  rating?: string;
  /** Ids plateformes (web|ios|android|…) — labels jamais comparés. */
  platforms: string[];
  /** Id audience (all|kids|…) — badge via config/ratings. */
  audienceId: string;
  lifecycle?: string;
  comments?: number;
  /** MRR vérifié en centimes — null/absent = pas de badge (jamais de faux chiffre). */
  mrrCents?: number | null;
  /** Date ISO de publication — sert au badge "Nouveau" du tri récent. */
  publishedAt?: string | null;
  /** Veille internationale : badge + vote désactivé (hors jeu). */
  curated?: boolean;
};

export function ProductCard({ product }: { product: ProductCardProps }) {
  const category = getCategoryById(product.categoryId);
  const rating = getRatingById(product.audienceId);

  return (
    <div className="group flex flex-col p-6 rounded-[10px] bg-muted/40 hover:bg-muted/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/50 border border-transparent hover:border-border/50 h-full relative">
      {/* CARD TOP: Icon & Vote */}
      <div className="flex items-start justify-between w-full mb-5">
        <div
          className={cn(
            "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:group-hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]",
            product.iconGradient,
          )}
        >
          {product.initials}
        </div>
        <div className="flex items-center gap-2">
          {/* Comment Count Pill */}
          <Link
            href={`/products/${product.slug}#comments`}
            className="flex items-center gap-1.5  text-muted-foreground transition-colors z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatCircleTextIcon weight="fill" className="w-[14px] h-[14px]" />
            <span className="text-[12px] font-bold leading-none">{product.comments ?? 0}</span>
          </Link>

          <VoteButton
            productId={product.id}
            productName={product.name}
            votes={product.votes}
            initialVoted={product.initialVoted ?? false}
            variant="pill"
            disabledReason={
              product.curated ? "Produit en veille : hors classement, votes désactivés." : undefined
            }
          />
        </div>
      </div>

      {/* CARD BODY: Content */}
      <div className="flex flex-col gap-1 mb-4 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/products/${product.slug}`} className="w-fit min-w-0">
            <h3 className="text-xl font-extrabold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </Link>
          {product.curated && (
            <span
              title="Veille internationale : pas un produit de la scène locale"
              className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400"
            >
              Veille
            </span>
          )}
        </div>
        <p className="text-[14px] leading-snug font-medium text-muted-foreground line-clamp-2 h-11">
          {product.tagline}
        </p>

        {/* Meta Line: Rating, Platforms, Classification, Pricing */}
        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
          {product.rating != null && product.rating !== "" && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
              <StarIcon weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
              {product.rating}
            </div>
          )}
          <div className="w-0.75 h-0.75 rounded-full bg-border" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {product.platforms?.includes("web") && (
              <GlobeIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
            {product.platforms?.includes("ios") && (
              <AppleLogoIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
            {product.platforms?.includes("android") && (
              <AndroidLogoIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
          </div>
          <div className="w-0.75 h-0.75 rounded-full bg-border" />
          <AgeBadge value={rating.badge} size="xs" />

          {product.pricing !== "free" && (
            <>
              <div className="w-0.75 h-0.75 rounded-full bg-border" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#B58A43]">
                {product.pricing === "paid" ? "Payant" : "Freemium"}
              </span>
            </>
          )}
          {product.mrrCents != null && product.mrrCents > 0 && (
            <>
              <div className="w-0.75 h-0.75 rounded-full bg-border" />
              <RevenueBadge revenue={deriveRevenueView(product.id, product.mrrCents)} size="sm" />
            </>
          )}
        </div>
      </div>

      {/* CARD FOOTER: Category & Maker */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          {category && (
            <Link
              href={`/categories/${category.id}`}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm transition-colors border relative z-10",
                category.chipClass,
                category.hoverClass,
              )}
            >
              {category.name}
            </Link>
          )}
          {product.lifecycle && product.lifecycle !== "live" && (
            <LifecyclePill lifecycleId={product.lifecycle} />
          )}
        </div>

        <Link
          href={`/makers/${product.makerUsername}`}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity relative z-10"
        >
          <AvatarImage
            src={product.makerAvatar}
            name={product.maker}
            size={20}
            className="grayscale group-hover:grayscale-0 transition-opacity"
          />
          <span className="text-[11px] font-bold text-foreground">{product.maker}</span>
          <SealCheckIcon weight="fill" className="w-3.5 h-3.5 text-blue-500 -ml-0.5" />
        </Link>
      </div>

      {/* Entire card is clickable background link for better UX */}
      <Link
        href={`/products/${product.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${product.name}`}
      />
    </div>
  );
}
