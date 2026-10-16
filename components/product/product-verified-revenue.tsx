import { RevenueBlock } from "@/components/revenue/revenue-block";
import { getProductRevenueView } from "@/services/revenue/views";

/**
 * Bloc revenus de la fiche : réel (snapshots DB) ou rien (jamais de mock).
 * Serveur : le libellé de fraîcheur arrive pré-calculé (règle purity).
 */
export async function ProductVerifiedRevenue({ productId }: { productId: string }) {
  const revenue = await getProductRevenueView(productId).catch(() => null);
  if (!revenue) return null;
  return <RevenueBlock revenue={revenue} lastSyncedLabel={revenue.lastSyncedLabel} />;
}
