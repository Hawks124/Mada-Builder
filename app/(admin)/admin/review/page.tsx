import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewQueue } from "@/components/admin/review-queue";
import { getReviewQueueList } from "@/app/actions/products";
import { toReviewItem } from "@/services/products.service";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — En revue",
  robots: { index: false, follow: false },
};

// Toujours dynamique : file staff par définition (pré-rendu statique
// sans session = soit vide mensonger, soit crash de build — M8).
export const dynamic = "force-dynamic";

// File de revue (§9) : approuver / rejeter + motif. Rien de plus.
// Gate staff au layout (admin) — file DB, triée par ancienneté (SLA 24 h).
export default async function AdminReviewPage() {
  const rows = await getReviewQueueList();
  const items = rows.map((r) => toReviewItem(r, { shotCount: r.shotCount }));

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="En revue"
        subtitle={`${items.length} soumission${items.length > 1 ? "s" : ""} en attente — objectif : revue sous 24 h, rejet toujours motivé.`}
      />
      <ReviewQueue items={items} />
    </div>
  );
}
