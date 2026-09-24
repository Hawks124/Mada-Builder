"use client";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  StarIcon,
  GlobeIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  ChatCircleTextIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { AgeBadge } from "@/components/ui/age-badge";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import type { ProductCardProps } from "@/components/product/product-card";

export function DirectoryCard({ product }: { product: ProductCardProps }) {
  const category = getCategoryById(product.categoryId);
  const CategoryIcon = category?.icon;

  return (
    <div className="group relative flex flex-col sm:flex-row items-stretch sm:items-center p-5 rounded-[20px] bg-background border border-border/60 hover:border-border hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-300 gap-5">
      {/* 1. APP ICON */}
      <div className="shrink-0 flex items-center sm:items-start h-full">
        <div
          className={cn(
            "w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[20px] flex items-center justify-center text-white font-black text-2xl bg-linear-to-br shadow-sm transition-transform duration-500 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:group-hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]",
            product.iconGradient,
          )}
        >
          {product.initials}
        </div>
      </div>

      {/* 2. CORE INFO */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between sm:justify-start gap-4 mb-1">
          <Link
            href={`/products/${product.id}`}
            className="hover:opacity-80 transition-opacity w-fit z-10"
          >
            <h3 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-foreground leading-none">
              {product.name}
            </h3>
          </Link>

          {/* Mobile Action (Votes + Comments) */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <CaretUpIcon weight="bold" className="text-emerald-500" />
              {product.votes}
            </div>
          </div>
        </div>

        <p className="text-[15px] font-medium text-muted-foreground mt-1 line-clamp-2 md:line-clamp-1 leading-snug pr-4">
          {product.tagline}
        </p>

        {/* METADATA CHIPS ROW */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-2 mt-3.5">
          {category && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-[6px] border border-border/40 transition-colors",
                category.chipClass,
              )}
            >
              {CategoryIcon && <CategoryIcon weight="bold" className="w-3.5 h-3.5" />}
              {category.name}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/60 px-2 py-1 rounded-[6px] border border-border/40 hover:bg-muted transition-colors">
            {product.platforms.includes("Web") && (
              <GlobeIcon weight="bold" className="w-[14px] h-[14px]" />
            )}
            {product.platforms.includes("iOS") && (
              <AppleLogoIcon weight="fill" className="w-[14px] h-[14px]" />
            )}
            {product.platforms.includes("Android") && (
              <AndroidLogoIcon weight="fill" className="w-[14px] h-[14px]" />
            )}
          </div>

          <div className="flex items-center gap-1 text-[12px] font-black text-foreground bg-muted/60 border border-border/40 px-2 py-1 rounded-[6px]">
            <StarIcon weight="fill" className="w-[14px] h-[14px] text-yellow-500" />
            {product.rating}
          </div>

          <AgeBadge value={product.classification} size="xs" />

          {product.pricing !== "free" && (
            <span className="text-[10px] font-black uppercase tracking-widest text-[#B58A43] bg-[#B58A43]/10 px-2 py-1 rounded-[6px] border border-[#B58A43]/20">
              Payant
            </span>
          )}

          {product.lifecycle && product.lifecycle !== "live" && (
            <LifecyclePill lifecycleId={product.lifecycle} />
          )}
        </div>
      </div>

      {/* 3. RIGHT SECTION (Desktop): Engagement & MAKER */}
      <div className="hidden sm:flex flex-col items-end justify-between shrink-0 pl-6 border-l border-border/40 min-w-[140px] h-full gap-4">
        {/* Engagement Data */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/30 border border-border/40 min-w-[56px] group-hover:bg-muted transition-colors">
            <ChatCircleTextIcon
              weight="fill"
              className="w-[18px] h-[18px] text-muted-foreground mb-0.5"
            />
            <span className="text-[13px] font-black">{Math.floor(product.votes / 3)}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-background border border-border shadow-sm min-w-[56px] group-hover:border-foreground/30 transition-colors">
            <CaretUpIcon weight="bold" className="w-[20px] h-[20px] text-emerald-500 -mt-1" />
            <span className="text-[14px] font-black leading-none">{product.votes}</span>
          </div>
        </div>

        {/* Maker Profile Link */}
        <Link
          href={`/makers/${slugifyName(product.maker)}`}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity z-10"
          onClick={(e) => e.stopPropagation()} // Prevent card click
        >
          <span className="text-[11px] font-bold text-muted-foreground">par</span>
          <AvatarImage
            src={product.makerAvatar}
            name={product.maker}
            size={18}
            className="grayscale group-hover:grayscale-0 transition-opacity ml-0.5"
          />
          <span className="text-[12px] font-black text-foreground">{product.maker}</span>
        </Link>
      </div>

      {/* OVERLAY LINK EXTENSIONS */}
      <Link
        href={`/products/${product.id}`}
        className="absolute inset-0 z-0 opacity-0"
        aria-label={`Voir ${product.name}`}
      />
    </div>
  );
}
