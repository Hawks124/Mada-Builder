import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewQueue } from "@/components/admin/review-queue";
import { MOCK_REVIEW_QUEUE } from "@/components/admin/admin-mock";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — En revue",
  robots: { index: false, follow: false },
};

// File de revue (§9) : approuver / rejeter + motif. Rien de plus.
// Gate staff au layout (admin) — données réelles au milestone listings.
export default function AdminReviewPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="En revue"
        subtitle={`${MOCK_REVIEW_QUEUE.length} soumissions en attente — objectif : revue sous 24 h, rejet toujours motivé.`}
      />
      <ReviewQueue />
    </div>
  );
}
