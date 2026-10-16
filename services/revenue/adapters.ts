/**
 * Interface unique des 5 adaptateurs (Phase 2 MRR) : `probe` (validation
 * légère à la connexion) + `fetchRevenue` (calcul horaire). Règles
 * transverses : essais et impayés exclus partout, devise native jamais
 * convertie, montants validés, erreurs explicites (jamais de chiffre
 * deviné — échec franc plutôt que MRR faux).
 */
import type { RevenueProviderId, RevenueResult } from "./types";

export type ProviderContext = {
  /** Clé en clair (déchiffrée pour la durée du seul appel). */
  key: string;
  /** Config non-secrète (project_id, store_id…). */
  config: Record<string, string>;
};

export type RevenueAdapter = {
  /** Appel léger : valide clé + permissions + config (erreur claire sinon). */
  probe: (ctx: ProviderContext) => Promise<void>;
  /** Calcul MRR + abonnés (pagination complète, jamais de 1re page seule). */
  fetchRevenue: (ctx: ProviderContext) => Promise<RevenueResult>;
};

export type AdapterMap = Record<RevenueProviderId, RevenueAdapter>;
