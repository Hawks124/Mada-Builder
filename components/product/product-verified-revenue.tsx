"use client";

import { RevenueBlock } from "@/components/revenue/revenue-block";
import {
  deriveRevenueView,
  formatSyncedLabel,
  syncedMinutesAgo,
} from "@/components/revenue/revenue-derive";

/**
 * Enveloppe de la fiche produit.
 *
 * La page fiche est entièrement en dur (Jalon 0), donc l'instantané vérifié
 * est dérivé ici depuis l'id du produit comme sur le reste du site. Le jour où
 * la fiche lit un produit réel, ce composant se réduit à un `revenue` en prop
 * et la page s'en charge — `RevenueBlock` ne bouge pas.
 */
export function ProductVerifiedRevenue({ productId }: { productId: string }) {
  const revenue = deriveRevenueView(productId, 25_000);

  return (
    <RevenueBlock
      revenue={revenue}
      lastSyncedLabel={formatSyncedLabel(syncedMinutesAgo(productId))}
    />
  );
}
