import { AvatarImage } from "@/components/ui/avatar-image";
import {
  SealCheckIcon,
  StarIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  ChatCircleTextIcon,
} from "@phosphor-icons/react";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { VoteButton } from "@/components/votes/vote-button";
import { AgeBadge } from "@/components/ui/age-badge";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import Link from "next/link";

// Extracted from NewestProducts to be used globally (NewestProducts, DiscoverGrid, etc.)
export type ProductCardProps = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  maker: string;
  makerAvatar: string;
  votes: number;
  iconGradient: string;
  initials: string;
  pricing: string; // 'free' | 'freemium' | 'paid' etc.
  rating: string;
  platforms: string[];
  classification: string;
  lifecycle?: string;
  comments?: number;
};

export function ProductCard({ product }: { product: ProductCardProps }) {
  const category = getCategoryById(product.categoryId);

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
            href={`/products/${product.id}#comments`}
            className="flex items-center gap-1.5  text-muted-foreground transition-colors z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatCircleTextIcon weight="fill" className="w-[14px] h-[14px]" />
            <span className="text-[12px] font-bold leading-none">
              {product.comments ?? Math.floor((product.votes || 0) / 4) + 1}
            </span>
          </Link>

          <VoteButton
            productId={product.id}
            productName={product.name}
            votes={product.votes}
            variant="pill"
          />
        </div>
      </div>

      {/* CARD BODY: Content */}
      <div className="flex flex-col gap-1 mb-4 flex-1">
        <Link href={`/products/${product.id}`} className="w-fit">
          <h3 className="text-xl font-extrabold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-[14px] leading-snug font-medium text-muted-foreground line-clamp-2 h-11">
          {product.tagline}
        </p>

        {/* Meta Line: Rating, Platforms, Classification, Pricing */}
        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
          <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
            <StarIcon weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
            {product.rating}
          </div>
          <div className="w-0.75 h-0.75 rounded-full bg-border" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {product.platforms?.includes("Web") && (
              <GlobeIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
            {product.platforms?.includes("iOS") && (
              <AppleLogoIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
            {product.platforms?.includes("Android") && (
              <AndroidLogoIcon
                weight="fill"
                className="w-3.5 h-3.5 hover:text-foreground transition-colors"
              />
            )}
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
          href={`/makers/${slugifyName(product.maker)}`}
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
        href={`/products/${product.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${product.name}`}
      />
    </div>
  );
}
