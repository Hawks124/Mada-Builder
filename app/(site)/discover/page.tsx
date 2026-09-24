"use client";

import { useState } from "react";
import { DiscoverToolbar } from "@/components/discover/discover-toolbar";
import { DiscoverGrid } from "@/components/discover/discover-grid";

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)] bg-background">
      {/* ── HEADER & TOOLBAR ── */}
      <div className="w-full border-b border-border/40 bg-background">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto py-8">
          <div className="mb-6">
            <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
              Explorer la tech malgache
            </h1>
            <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-2 max-w-2xl">
              <span className="font-bold text-foreground"> +{`1 329`} </span> produits, apps, SaaS
              et outils construits par des makers de Madagascar. Découvrez, votez, et soutenez la
              scène locale.
            </p>
          </div>
          <DiscoverToolbar onSearchChange={setSearchQuery} />
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="w-full flex-1">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto py-10">
          <DiscoverGrid searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
}
