import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { sendWeeklyDigest } from "@/services/notifications.service";

export const dynamic = "force-dynamic";

/**
 * Cron digest hebdo (Phase 2 newsletter) : `POST /api/cron/digest`
 * (Bearer CRON_SECRET, workflow `digest-weekly.yml` lundi 7 h Tana).
 * Même garde que `/api/cron/revenue` : sans secret configuré, 503
 * franche (fail closed). `?dryRun=1` = comptes sans envoyer (vérif +
 * contrôle prod sans spammer). Réponse = compteurs seuls.
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
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const summary = await sendWeeklyDigest({ dryRun });
    return apiOk({ ...summary, dryRun });
  } catch (e) {
    return apiCatch(e, "api.cron.digest");
  }
}

export async function GET(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "POST uniquement."), "api.cron.digest");
}
