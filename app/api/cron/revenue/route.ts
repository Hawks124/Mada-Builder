import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { checkCron } from "@/lib/api/cron";
import { syncRevenueHourly } from "@/services/revenue/sync";

export const dynamic = "force-dynamic";

/**
 * Cron sync revenus (Phase 2 MRR) : `POST /api/cron/revenue` (Bearer
 * CRON_SECRET, workflow `revenue-sync.yml` horaire). Sans secret configuré :
 * 503 franche (fail closed — jamais de sync sans garde). Réponse = résumé
 * (compteurs seuls, jamais de clé ni de montant nominatif détaillé).
 * Lot B : si TOUTES les connexions échouent (0 réussite, ≥ 1 échec), la
 * route répond 503 — un run « tout rouge » ne doit jamais ressembler à un
 * 200. L'alerte par produit (2 échecs consécutifs live déjà côté sync).
 */

export async function POST(req: Request): Promise<Response> {
  try {
    checkCron(req);
    const summary = await syncRevenueHourly();
    if (summary.synced === 0 && summary.failed > 0) {
      throw new ApiError("INTERNAL", 503, `Sync revenus : ${summary.failed} échec(s), 0 réussite.`);
    }
    return apiOk(summary);
  } catch (e) {
    return apiCatch(e, "api.cron.revenue");
  }
}

export async function GET(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "POST uniquement."), "api.cron.revenue");
}
