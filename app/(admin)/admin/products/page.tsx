import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProductsTable } from "@/components/admin/products-table";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Produits",
  robots: { index: false, follow: false },
};

// Produits acceptés : voir + suppression manuelle (non-conformité).
// TODO(auth): role-gate server.
export default function AdminProductsPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Produits"
        subtitle="Listings publiés — recherche, filtre par catégorie, suppression manuelle."
      />
      <ProductsTable />
    </div>
  );
}
