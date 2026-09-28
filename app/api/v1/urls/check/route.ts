import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { requireApiUserOrSession } from "@/lib/api/auth-session";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { checkUrl } from "@/services/url-check.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — vérification uniquement.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);

/**
 * Vérification d'URL à la volée (formulaires web + mobile) : `{ url,
 * force? }` → `{ verdict, status, finalUrl, cached }` (TOUJOURS 200 :
 * c'est un résultat, pas une erreur — `block`/`warn` se décident côté
 * client via `classifyForSubmit`, et le serveur re-vérifie au submit).
 * Budget total ~9 s (timeout HEAD 4 s + GET 8 s, jamais cumulés au pire
 * nominal). Rate-limit serré : l'endpoint fetch des URLs attaquantes —
 * le cache global TTL 24 h fait le reste (anti-martèlement).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Double voie : Bearer (mobile) ou session cookie same-origin (web).
    const user = await requireApiUserOrSession(req, { allowBanned: true });
    await apiLimit("api:urls:check", user.id, API_WINDOWS.file);
    const body = await readJson(req);
    const url = typeof body.url === "string" ? body.url : "";
    if (url.trim() === "" || url.length > 2048) {
      throw new ApiError("VALIDATION", 422, "URL manquante ou trop longue.");
    }
    const result = await checkUrl(url, { force: body.force === true });
    return apiOk(result);
  } catch (e) {
    return apiCatch(e, "api.urls.check");
  }
}
