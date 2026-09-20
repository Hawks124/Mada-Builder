"use client";

import { GridBackground } from "@/components/ui/grid-background";
import { Hero } from "@/components/home/hero";
import { FeaturedProduct } from "@/components/home/featured-product";
import { Leaderboard } from "@/components/home/leaderboard";
import { NewestProducts } from "@/components/home/newest-products";
import { VerifiedRevenueSection } from "@/components/home/verified-revenue-section";
import { CommunityCTA } from "@/components/home/community-cta";

export default function Home() {
  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ─── DISCOVERY ZONE (Grid continues: Hero → Featured → Leaderboard) ─── */}
      <div className="relative flex flex-col w-full overflow-hidden border-b border-border/20">
        {/* Grid background — extends through the whole discovery zone */}
        <div className="absolute inset-0 pointer-events-none">
          <GridBackground variant="css" showBottomFade={false} />
        </div>

        <Hero />

        {/* ─── FEATURED PRODUCT SECTION ─── */}
        <div className="w-full relative pt-16 pb-12">
          <FeaturedProduct />
        </div>

        {/* ─── LEADERBOARD SECTION ─── */}
        <div className="w-full relative border-t border-border/20 pb-8">
          <Leaderboard />
        </div>

        {/* Magic fade: grid dissolves into the solid background right at the Newest seam */}
        <div className="absolute inset-x-0 bottom-0 h-60 bg-linear-to-t from-background via-background/85 to-transparent pointer-events-none" />
      </div>

      {/* ─── NEWEST PRODUCTS (FRESHLY SHIPPED) ─── */}
      <div className="w-full bg-background border-t border-border/20 relative">
        <NewestProducts />
      </div>

      {/* ─── VERIFIED REVENUE WALL ─── */}
      <div className="w-full bg-background border-t border-border/20 relative">
        <VerifiedRevenueSection />
      </div>

      {/* ─── COMMUNITY CTA BANNER ─── */}
      <div className="w-full">
        <CommunityCTA />
      </div>
    </div>
  );
}
