import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { OverviewApps } from "@/components/dashboard/overview-apps";
import { getSessionUser } from "@/lib/supabase/server";
import { getMakerAppsDashboard } from "@/services/dashboard.service";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Mes produits",
  robots: { index: false, follow: false },
};

// Toujours dynamique : données personnelles (jamais de HTML statique
// partagé entre makers).
export const dynamic = "force-dynamic";

// Produits du maker — section dédiée (sortie de la vue d'ensemble pour
// laisser la place aux futurs graphes). Mêmes données, même composant.
export default async function DashboardProductsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin?next=/dashboard/products");
  const apps = await getMakerAppsDashboard(sessionUser.id);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Mes produits"
        subtitle="Soumissions, statuts et performance — gérez chaque fiche."
      />
      <OverviewApps apps={apps} />
    </div>
  );
}
