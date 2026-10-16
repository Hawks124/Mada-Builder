import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { syncRevenueHourly } from "@/services/revenue/sync";

export const dynamic = "force-dynamic";

/**
 * Cron sync revenus (Phase 2 MRR) : `POST /api/cron/revenue` (Bearer
 * CRON_SECRET, workflow `revenue-sync.yml` horaire). Sans secret configuré :
 * 503 franche (fail closed — jamais de sync sans garde). Réponse = résumé
 * (compteurs seuls, jamais de clé ni de montant nominatif détaillé).
 */
function checkCron(req: Request): void {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (expected === "") throw new ApiError("INTERNAL", 503, "Cron non configuré.");
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) throw new ApiError("FORBIDDEN", 403, "Interdit.");
}

export async function POST(req: Request): Promise<Response> {
  try {
    checkCron(req);
    const summary = await syncRevenueHourly();
    return apiOk(summary);
  } catch (e) {
    return apiCatch(e, "api.cron.revenue");
  }
}

export async function GET(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "POST uniquement."), "api.cron.revenue");
}
