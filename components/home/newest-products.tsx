"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ProductCard, type ProductCardProps } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Nouveautés home — grille de cartes (récence pure). Données réelles via
 * props (la page charge `getNewest`) ; état vide honnête (jamais de
 * cartes d'emprunt).
 */
export function NewestProducts({
  items,
  votedIds = [],
}: {
  items: ProductCardProps[];
  votedIds?: string[];
}) {
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

      {/* GRID */}
      {items.length === 0 ? (
        <EmptyState
          title="Rien de neuf pour le moment"
          description="Les prochains produits publiés apparaîtront ici automatiquement."
          action={
            <Link
              href="/products/submit"
              className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              Publier le premier
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, initialVoted: votedIds.includes(product.id) }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
