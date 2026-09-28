/**
 * Vue "revenus vérifiés" — le modèle que consume l'UI.
 *
 * Miroir des tables qui arriveront au Jalon 4 (`revenue_connections` +
 * `revenue_snapshots`, PRD §8). Les montants sont **en centimes** partout, la
 * conversion en unité d'affichage se fait uniquement dans `formatMoney`.
 *
 * `displayMode` vient de `revenue_connections.display_mode` : `badge_only`
 * permet au maker de publier la vérification sans le chiffre. C'est le levier
 * d'adoption principal de la feature (PRD §6) — il doit être respecté partout,
 * y compris sur la fiche du produit lui-même.
 */
export type RevenueProvider = "stripe" | "revenuecat";
export type RevenueDisplayMode = "full" | "badge_only";

export type RevenueView = {
  provider: RevenueProvider;
  displayMode: RevenueDisplayMode;
  /** MRR mensuel récurrent, en centimes. */
  mrrCents: number;
  /** Run rate annuel = mrrCents × 12, en centimes. */
  arrCents: number;
  activeSubscribers: number;
  /** ISO 8601 — sert au libellé « vérifié il y a N h », calculé côté serveur. */
  lastSyncedAt: string;
  /** MRR en centimes, du plus ancien au plus récent (90 j). */
  history: number[];
};

export const REVENUE_PROVIDERS: Record<
  RevenueProvider,
  { label: string; logo: string; brand: string }
> = {
  stripe: { label: "Stripe", logo: "/logos/stripe.svg", brand: "#635BFF" },
  revenuecat: { label: "RevenueCat", logo: "/logos/revenuecat.svg", brand: "#F5820D" },
};
