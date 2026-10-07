import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewQueue } from "@/components/admin/review-queue";
import { nudgeMakerAction } from "@/app/actions/products";
import { fetchRejectedQueue, toReviewItem, NUDGE_COOLDOWN_DAYS } from "@/services/products.service";

// Mapping hors composant (react-hooks/purity : pas de Date.now() dans le
// rendu — toReviewItem fait pareil côté service).
function toRejectedItems(
  rows: Awaited<ReturnType<typeof fetchRejectedQueue>>,
): ComponentProps<typeof ReviewQueue>["items"] {
  const now = Date.now();
  return rows.map((r) => {
    const base = toReviewItem(r, { shotCount: 0 });
    const since = r.rejectedAt ?? r.createdAt;
    const rejectedDays = Math.max(0, Math.floor((now - since.getTime()) / 86_400_000));
    const lastNudge = r.lastNudgedAt
      ? Math.max(0, Math.floor((now - r.lastNudgedAt.getTime()) / 86_400_000))
      : null;
    return {
      ...base,
      waitingText: `Rejeté depuis ${rejectedDays} j`,
      waitingHours: Math.max(0, Math.floor((now - since.getTime()) / 3_600_000)),
      rejectionReason: r.rejectionReason ?? undefined,
      nudgeText: lastNudge === null ? "Jamais rappelé." : `Dernier rappel il y a ${lastNudge} j.`,
      nudgeDisabled: lastNudge !== null && lastNudge < NUDGE_COOLDOWN_DAYS,
    };
  });
}

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Rejetés",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Rejetés : MÊME design que la file de revue (variante `rejected` de
// ReviewQueue : pill "Rejeté" au lieu du SLA, bouton "Rappeler" au lieu
// de "Vérifier"). Jours depuis rejet + dernier rappel depuis l'audit
// (pas de colonne dédiée) ; cooldown 3 j (bouton verrouillé + barrière
// serveur). Gate staff au layout (admin).
export default async function AdminRejectedPage() {
  const rows = await fetchRejectedQueue({ isStaff: true }).catch(() => []);
  const items = toRejectedItems(rows);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Rejetés"
        subtitle={`${items.length} produit${items.length > 1 ? "s" : ""} en attente de correction — rappelez les makers par email.`}
      />
      <ReviewQueue
        items={items}
        variant="rejected"
        onNudge={async (id: string) => {
          "use server";
          return nudgeMakerAction({ productId: id });
        }}
      />
    </div>
  );
}
