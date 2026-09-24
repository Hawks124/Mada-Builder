"use client";

import Link from "next/link";
import { ProductHeader } from "@/components/product/product-header";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductAbout } from "@/components/product/product-about";
import { ProductVerifiedRevenue } from "@/components/product/product-verified-revenue";
import { ProductReviews } from "@/components/product/product-reviews";
import { ProductComments } from "@/components/product/product-comments";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductSidebar } from "@/components/product/product-sidebar";

export default function ProductPage() {
  return (
    <div className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-6 md:pt-10 pb-24 relative z-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] md:text-[13px] font-semibold text-muted-foreground mb-6 md:mb-8">
        <Link href="/products" className="hover:text-foreground transition-colors">
          Apps
        </Link>
        <span className="opacity-50">/</span>
        <Link href="/categories/finance" className="hover:text-foreground transition-colors">
          Finance
        </Link>
        <span className="opacity-50">/</span>
        <span className="text-foreground">Tarsi - Budget Tracker</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-start">
        {/* Main Content (~65%) */}
        <div className="lg:col-span-8 flex flex-col gap-10 md:gap-12">
          <ProductHeader />
          <ProductGallery />
          <ProductAbout />
          <ProductVerifiedRevenue />
          <RelatedProducts />
          <ProductReviews id="reviews" />
          <ProductComments />
        </div>

        {/* Sticky Sidebar (~35%) */}
        <div className="lg:col-span-4 lg:sticky lg:top-6">
          <ProductSidebar />
        </div>
      </div>
    </div>
  );
}
