import { apiCatch, apiOk, corsPreflight, methodNotAllowed } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { getAppealEligibility } from "@/services/appeals.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — lecture seule (le dépôt vit à POST /appeals).
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);

/**
 * Statut d'appel — lecture seule, TOUJOURS 200 (c'est un état, pas une
 * erreur) : `{ eligible, message }`. Le mobile grise le bouton et
 * affiche `message` ("Prochain appel possible dans X h"…). Les règles
 * sont identiques à `submitAppeal` (pas de refus surprise).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:appeals:read", user.id, API_WINDOWS.read);
    const eligibility = await getAppealEligibility(user.id);
    return apiOk(
      eligibility.ok
        ? { eligible: true as const, message: null as string | null }
        : { eligible: false as const, message: eligibility.message },
    );
  } catch (e) {
    return apiCatch(e, "api.appeals.mine");
  }
}
