import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { checkCron } from "@/lib/api/cron";
import { sendWeeklyDigest } from "@/services/notifications.service";

export const dynamic = "force-dynamic";

/**
 * Cron digest hebdo (Phase 2 newsletter) : `POST /api/cron/digest`
 * (Bearer CRON_SECRET, workflow `digest-weekly.yml` lundi 7 h Tana).
 * Même garde que `/api/cron/revenue` et `/api/cron/maintenance` : sans
 * secret configuré, 503 franche (fail closed). `?dryRun=1` = comptes
 * sans envoyer (vérif + contrôle prod sans spammer — sans poser le
 * verrou). `?force=1` = efface le verrou de la semaine courante
 * (rattrapage manuel vers un envoi avorté — lot B). Réponse = compteurs
 * seuls (+ `alreadySent: true` quand la semaine a déjà été émise).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    checkCron(req);
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const force = url.searchParams.get("force") === "1";
    const summary = await sendWeeklyDigest({ dryRun, force });
    return apiOk({ ...summary, dryRun });
  } catch (e) {
    return apiCatch(e, "api.cron.digest");
  }
}

export async function GET(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "POST uniquement."), "api.cron.digest");
}
