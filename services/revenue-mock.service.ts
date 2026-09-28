import { getCatalog } from "@/services/catalog-mock.service";
import { deriveRevenueView, syncedMinutesAgo } from "@/components/revenue/revenue-derive";
import type { RevenueView } from "@/components/revenue/revenue-types";

/**
 * Revenus vérifiés — jointure serveur entre le catalogue partagé et les
 * instantanés vérifiés.
 *
 * Aucune table, aucun appel API. Quand le Jalon 4 arrive (tables
 * `revenue_connections` + `revenue_snapshots`, `services/revenue.service.ts`),
 * **ce fichier entier** est remplacé par les lectures réelles — l'UI ne bouge
 * pas, puisque `RevenueView` reste le contrat.
 *
 * Le reste du travail (provider, mode d'affichage, courbe 90 j) vit dans
 * `components/revenue/revenue-derive.ts` : déterministe et sans dépendance, donc
 * les composants clients peuvent dériver le même instantané sans embarquer le
 * catalogue dans leur bundle.
 */
export type RevenueRecord = RevenueView & {
  productId: string;
  syncedMinutesAgo: number;
};

export function getRevenueRecords(): RevenueRecord[] {
  return getCatalog()
    .filter((p) => p.mrrCents != null)
    .map((p) => {
      const view = deriveRevenueView(p.id, p.mrrCents!);
      return {
        ...view,
        productId: p.id,
        syncedMinutesAgo: syncedMinutesAgo(p.id),
      };
    });
}

let cached: Map<string, RevenueRecord> | null = null;

/** Index des revenus par produit, mémoïsé comme le catalogue. */
export function getRevenueIndex(): Map<string, RevenueRecord> {
  cached ??= new Map(getRevenueRecords().map((r) => [r.productId, r]));
  return cached;
}
