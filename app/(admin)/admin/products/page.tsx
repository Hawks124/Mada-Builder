import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProductsTable } from "@/components/admin/products-table";
import type { AdminProduct } from "@/components/admin/admin-mock";
import { fetchAdminProducts, getProductsEngagement } from "@/services/products.service";
import { appGradientFor, appInitialsFor } from "@/services/products.service";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Produits",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Produits publiés UNIQUEMENT (le sous-titre le dit) : la file pending
// vit sur /admin/review, les rejetés sur /admin/rejected. Données DB
// (votes/vues réels). Gate staff au layout (admin) — pas de gate par page.
export default async function AdminProductsPage() {
  const { items } = await fetchAdminProducts({
    isStaff: true,
    status: "published",
    limit: 50,
  }).catch(() => ({
    items: [],
  }));
  const engagement: Record<string, { views: number; clicks: number }> = await getProductsEngagement(
    items.map((r) => r.id),
  ).catch(() => ({}));
  const apps: AdminProduct[] = items.map((r) => ({
    id: r.id,
    slug: r.slug,
    curated: r.curated,
    name: r.name,
    tagline: r.tagline,
    categoryId: r.category,
    productType: r.productType,
    platforms: r.platforms,
    audienceId: r.audience,
    pricing: r.pricingModel,
    version: r.version ?? undefined,
    launchedAt: r.publishedAt
      ? r.publishedAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : "brouillon",
    publishedTs: (r.publishedAt ?? r.createdAt).getTime(),
    tags: r.tags,
    lifecycle: (["dev", "beta", "live"] as const).find((l) => l === r.lifecycle) ?? "live",
    votes: r.upvoteCount,
    views: engagement[r.id]?.views ?? 0,
    rating: 0,
    revenue: undefined,
    iconGradient: appGradientFor(r.id),
    initials: appInitialsFor(r.name),
    maker: {
      name: r.makerDisplayName,
      username: r.makerUsername,
      avatarUrl: r.makerAvatarUrl ?? "",
    },
  }));
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Produits"
        subtitle="Listings publiés — recherche, filtre par catégorie, suppression manuelle."
      />
      <ProductsTable initialApps={apps} />
    </div>
  );
}
