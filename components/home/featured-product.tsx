import {
  ChatCircleTextIcon,
  StarIcon,
  SealCheckIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  WindowsLogoIcon,
  UsersIcon,
  GlobeIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ActionButton } from "@/components/ui/action-button";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { AgeBadge } from "@/components/ui/age-badge";
import { VoteButton } from "@/components/votes/vote-button";
import { getFeatured, type FeaturedProductData } from "@/services/home.service";

interface FeaturedProductProps {
  /** Défaut = produit du jour (home inchangée). */
  product?: FeaturedProductData;
  /** Version resserrée (page /leaderboard). Même contenu, moins d'air. */
  dense?: boolean;
}

/**
 * Hero produit du jour — spotlight éditorial standalone (PRD §11).
 * Data-driven via props ; la home utilise le défaut, /leaderboard en dense.
 */
export function FeaturedProduct({ product = getFeatured(), dense = false }: FeaturedProductProps) {
  const category = getCategoryById(product.categoryId);
  const makerSlug = slugifyName(product.maker);

  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div
        className={cn(
          "flex flex-col md:flex-row justify-between items-start",
          dense ? "gap-6 md:gap-8" : "gap-8 md:gap-12",
        )}
      >
        {/* LEFT: App Identity */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          {/* Sur-titre = label d'édition, **pas** un titre de section. C'était
              un `<h3>` alors qu'il précède le nom du produit : hiérarchie
              inversée sur les deux pages. */}
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground flex items-center gap-3">
            <span className="text-amber-500">★ Produit du jour</span>
            <span className="text-border hidden md:block">|</span>
            <span className="font-semibold text-muted-foreground hidden md:block">
              {product.dateLabel}
            </span>
          </p>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
            {/* Icon */}
            <Link
              href={`/products/${product.id}`}
              className={cn(
                "shrink-0 relative overflow-hidden rounded-3xl bg-background border border-border/40 shadow-sm transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                dense ? "w-24 h-24 md:w-28 md:h-28" : "w-28 h-28 md:w-32 md:h-32",
              )}
            >
              <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center text-white dark:text-zinc-900 text-5xl font-extrabold tracking-tighter">
                {product.initials}
              </div>
              <div className="absolute inset-0 rounded-3xl border border-black/5 dark:border-white/10 pointer-events-none" />
            </Link>

            {/* Title + Tagline + Tags */}
            <div className="flex flex-col justify-center gap-1.5 md:gap-2 min-w-0">
              <div className="group flex items-center gap-3 w-fit max-w-full flex-wrap">
                <Link href={`/products/${product.id}`}>
                  {/* `<h2>` et non `<h1>` : les deux pages qui l'hébergent ont
                      déjà leur `<h1>` (le hero sur `/`, « Le classement de la
                      tech malgache » sur `/leaderboard`). En `<h1>` ce
                      composant en créait un second par page. */}
                  <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tighter leading-none text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </h2>
                </Link>
                {/* Embedded Mini Tag = category */}
                {category && (
                  <Link
                    href={`/categories/${category.id}`}
                    className={cn(
                      "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors",
                      category.chipClass,
                      category.hoverClass,
                    )}
                  >
                    {category.name}
                  </Link>
                )}
              </div>

              <p className="text-lg md:text-xl font-medium tracking-tight text-muted-foreground leading-snug max-w-xl mt-1">
                {product.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Action Column */}
        <div className="flex flex-col items-center gap-5 mt-4 md:mt-0 shrink-0 w-full md:w-auto">
          {/* Vote + Comment — Zero UI (no borders, no bg) */}
          <div className="flex items-start justify-center gap-6 w-full md:w-auto">
            {/* Upvote */}
            <VoteButton
              productId={product.id}
              productName={product.name}
              votes={product.votes}
              variant="hero"
            />

            {/* Divider */}
            <div className="w-px bg-border/60 self-stretch" />

            {/* Comment */}
            <Link
              href={`/products/${product.id}#comments`}
              aria-label={`${product.comments} avis`}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <ChatCircleTextIcon
                weight="fill"
                className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors duration-200"
              />
              <span className="text-[22px] font-black tracking-tighter text-foreground leading-none tabular-nums">
                {product.comments}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                avis
              </span>
            </Link>
          </div>

          {/* CTA anchored at bottom */}
          <div className="flex flex-col items-center gap-1 w-full">
            <ActionButton
              href={`/products/${product.id}`}
              variant="primary"
              className="w-full h-12 text-[15px]"
            >
              Voir le produit
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
                className="w-4 h-4 ml-1"
                fill="currentColor"
              >
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
              </svg>
            </ActionButton>
            <span className="text-[10px] text-muted-foreground text-center font-medium">
              {product.pricingDetail}
            </span>
          </div>
        </div>
      </div>
      {/* Deep Metadata Grid */}
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-nowrap lg:items-start lg:justify-between gap-6 lg:gap-x-4 w-full border-t border-border/40",
          dense ? "mt-0 pt-6" : "mt-2 pt-8",
        )}
      >
        {/* 1. Maker */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Maker
          </span>
          <Link
            href={`/makers/${makerSlug}`}
            className="flex items-center gap-2 group p-1 -ml-1 rounded-full hover:bg-muted/50 transition-colors w-max"
          >
            <AvatarImage
              src={product.makerAvatar}
              name={product.maker}
              size={24}
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-[14px] font-semibold flex items-center gap-1 group-hover:text-primary transition-colors">
              {product.maker} <SealCheckIcon weight="fill" className="text-blue-500 w-3.5 h-3.5" />
            </span>
          </Link>
        </div>

        {/* 2. Plateformes — each icon in a <span> for reliable hover */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Plateformes
          </span>
          <div className="flex items-center gap-3 pl-1">
            {product.platforms.includes("Web") && (
              <span className="text-foreground hover:text-sky-500 transition-colors cursor-pointer">
                <GlobeIcon weight="bold" className="w-4.5 h-4.5" />
              </span>
            )}
            {product.platforms.includes("iOS") && (
              <span className="text-foreground hover:text-foreground/50 transition-colors cursor-pointer">
                <AppleLogoIcon weight="fill" className="w-4.5 h-4.5" />
              </span>
            )}
            {product.platforms.includes("Android") && (
              <span className="text-foreground hover:text-green-500 transition-colors cursor-pointer">
                <AndroidLogoIcon weight="fill" className="w-4.5 h-4.5" />
              </span>
            )}
            <span className="text-foreground hover:text-blue-500 transition-colors cursor-pointer">
              <WindowsLogoIcon weight="fill" className="w-4.5 h-4.5" />
            </span>
          </div>
        </div>

        {/* 3. Catégories */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Catégories
          </span>
          <div className="flex items-center gap-1.5 pl-1">
            <Link
              href={`/categories/${category?.id ?? "other"}`}
              aria-label={category?.name ?? "Autre"}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-500 transition-colors cursor-pointer"
            >
              {category && <UsersIcon weight="fill" className="w-4.5 h-4.5" />}
              <span className="text-[13px] font-semibold">{category?.name ?? "Autre"}</span>
            </Link>
          </div>
        </div>

        {/* 4. Tarification */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Tarification
          </span>
          <div className="flex flex-col gap-0.5 pl-1">
            <span className="text-[13px] font-semibold text-foreground">
              {product.pricingLabel}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {product.pricingDetail}
            </span>
          </div>
        </div>

        {/* 5. Classification (Age) */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Classification
          </span>
          <div className="flex items-center gap-2 pl-1">
            <AgeBadge value={product.ageRating} size="md" />
            <span className="text-[12px] font-semibold text-foreground leading-tight">
              {product.ageLabel}
            </span>
          </div>
        </div>

        {/* 6. Avis */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Avis ({product.reviewsCount})
          </span>
          <Link
            href={`/products/${product.id}#reviews`}
            className="flex flex-col gap-1 pl-1 group cursor-pointer"
          >
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon
                  key={i}
                  weight="fill"
                  className="text-yellow-400 dark:text-yellow-500 w-4 h-4 group-hover:scale-110 transition-transform"
                />
              ))}
            </div>
            <span className="text-[13px] font-bold text-foreground group-hover:underline">
              {product.rating} sur 5
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
