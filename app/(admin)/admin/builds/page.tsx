import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { BuildsTable } from "@/components/admin/builds-table";
import { listAllBuildsForAdmin } from "@/services/builds.service";
import { appGradientFor, appInitialsFor, waitingFr } from "@/services/products.service";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Binaires",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Binaires (D6) : tous les builds, pending d'abord. Chaque ligne pointe
// vers son contexte (cockpit revue si à trancher, fiche publique sinon).
// Gate staff au layout (admin).
export default async function AdminBuildsPage() {
  const builds = await listAllBuildsForAdmin().catch(() => []);
  const pending = builds.filter((b) => b.status === "pending").length;

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Binaires"
        subtitle={
          pending > 0
            ? `${pending} APK en attente de revue — installez avant d'approuver.`
            : "APK envoyés par les makers, tous statuts."
        }
      />
      <BuildsTable
        builds={builds.map((b) => ({
          ...b,
          gradient: appGradientFor(b.productId),
          initials: appInitialsFor(b.productName),
          waitingText: waitingFr(new Date(b.createdAt)),
        }))}
        defaultFilter={pending > 0 ? "pending" : "all"}
      />
    </div>
  );
}
