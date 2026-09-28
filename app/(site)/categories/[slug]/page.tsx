import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { GridBackground } from "@/components/ui/grid-background";
import { DiscoverGrid } from "@/components/discover/discover-grid";
import { FilterProvider } from "@/components/discover/sidebar-filter";
import { parseDiscoverFilters } from "@/lib/discover-filters";
import { PRODUCT_CATEGORIES, getCategoryById } from "@/config/categories";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return PRODUCT_CATEGORIES.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryById(slug);
  if (!category) return { robots: { index: false, follow: false } };
  return {
    title: `${category.name} — produits tech malgaches | Mada-Made`,
    description: `Découvrez les produits tech construits à Madagascar en ${category.name} : ${category.subtitle}. Apps, SaaS et outils des makers malgaches.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const category = getCategoryById(slug);
  if (!category) notFound();
  const Icon = category.icon;

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ── HEADER ── */}
      <div className="relative w-full border-b border-border/40">
        <GridBackground variant="css" showBottomFade={false} glowPlacement="centered" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />
        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-8">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors mb-5"
          >
            <CaretLeftIcon weight="bold" className="w-4 h-4" />
            Toutes les catégories
          </Link>
          <div className="flex items-center gap-4 md:gap-5">
            <span
              className={cn(
                "flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-2xl",
                "border border-border/60 bg-background shadow-sm",
              )}
            >
              <Icon weight="duotone" className="h-6 w-6 md:h-7 md:w-7 text-foreground/70" />
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
                {category.name}
              </h1>
              <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-1">
                {category.subtitle} construits à Madagascar.
              </p>
            </div>
          </div>
          <p className="text-[13px] font-bold tabular-nums mt-4">
            <span className="text-foreground">{category.count}</span>{" "}
            <span className="text-muted-foreground font-medium">
              {category.count === 1 ? "produit" : "produits"}
            </span>
          </p>
        </div>
      </div>

      {/* ── GRILLE — même moteur que /discover, catégorie pré-filtrée ── */}
      <div className="w-full flex-1">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto py-10">
          <FilterProvider
            initialFilters={parseDiscoverFilters(new URLSearchParams([["cat", category.id]]))}
          >
            <DiscoverGrid searchQuery="" page={1} />
          </FilterProvider>
        </div>
      </div>
    </div>
  );
}
