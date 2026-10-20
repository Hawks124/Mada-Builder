import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { ProductCard, type ProductCardProps } from "@/components/product/product-card";

/**
 * Mises à jour récentes (D6, home) : MÊMES cartes que « Fraîchement
 * shippé » (pas de lignes custom) — seule différence : le cluster
 * vote+comment est remplacé par le bouton Installer (`installPath`).
 * Section masquée si vide (flux, pas d'état vide permanent au lancement).
 */
export function RecentUpdates({ items }: { items: ProductCardProps[] }) {
  if (items.length === 0) return null;
  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-16 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Mises à jour récentes
          </h2>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-1">
            Les apps que les makers viennent de mettre à jour.
          </p>
        </div>

        <Link
          href="/discover?sort=newest"
          className="group flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          Parcourir tout
          <ArrowRightIcon
            weight="bold"
            className="w-4 h-4 group-hover:translate-x-1 transition-transform"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
