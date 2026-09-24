"use client";

import { ProductCard } from "@/components/product/product-card";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Using the same mock data as NewestProducts for now to demonstrate layout
const MOCK_PRODUCTS = [
  {
    id: "6",
    name: "Fragments Vlog",
    tagline: "Record clips all day. Tap once at night for a finished mini-vlog.",
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

export function DiscoverGrid({ searchQuery }: { searchQuery: string }) {
  // En situation réelle, searchQuery serait utilisé pour filtrer ou appel API
  const filteredProducts = MOCK_PRODUCTS.filter((p) => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.maker.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.tagline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-16">
      {/* Ghost Cards Grid - 3 columns desktop */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {/* Duplicating for mockup fullness of a Directory Page */}
          {filteredProducts.map((product) => (
            <ProductCard key={`${product.id}-copy`} product={{...product, id: `${product.id}-copy`}} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl">🌱</span>
          </div>
          <h3 className="text-xl font-bold text-foreground mb-1">Aucun produit trouvé</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Essayez de modifier vos filtres ou de chercher un autre mot-clé.
          </p>
        </div>
      )}

      {/* SEO-Friendly Zero-UI Pagination */}
      {filteredProducts.length > 0 && (
        <div className="flex items-center justify-center gap-1 mt-8 pb-10">
          <PaginationLink href="?page=1" disabled>
            <CaretLeftIcon weight="bold" />
          </PaginationLink>
          
          <PaginationLink href="?page=1" isActive>1</PaginationLink>
          <PaginationLink href="?page=2">2</PaginationLink>
          <PaginationLink href="?page=3">3</PaginationLink>
          
          <span className="px-3 py-2 text-muted-foreground/50 select-none">...</span>
          
          <PaginationLink href="?page=83">83</PaginationLink>
          
          <PaginationLink href="?page=2">
            <CaretRightIcon weight="bold" />
          </PaginationLink>
        </div>
      )}
    </div>
  );
}

function PaginationLink({ 
  href, 
  isActive, 
  disabled, 
  children 
}: { 
  href: string; 
  isActive?: boolean; 
  disabled?: boolean; 
  children: React.ReactNode; 
}) {
  if (disabled) {
    return (
      <span className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground/30 font-semibold cursor-not-allowed select-none">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm transition-all",
        isActive 
          ? "bg-foreground text-background shadow-md border border-transparent scale-105" 
          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
      )}
    >
      {children}
    </Link>
  );
}
