"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ProductCard } from "@/components/product/product-card";

// MOCK_NEWEST array remains here... (in a real app, fetched from DB)

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
          href="/discover"
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
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
