import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  readJson,
  withCache,
  CACHE_PRIVATE,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { setDigestOptOut } from "@/services/users.service";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["PATCH"]);
export const POST = async () => methodNotAllowed(["PATCH"]);
export const PUT = async () => methodNotAllowed(["PATCH"]);
export const DELETE = async () => methodNotAllowed(["PATCH"]);

/**
 * Préférences de notification (mobile) — `{ digestOptOut?: boolean }`
 * (extensible aux futures prefs). Même service que le switch web
 * (`updateDigestPref`) : update ciblé, jamais le profil complet.
 * Réponse = `{ digestOptOut }` frais (pas de refetch côté mobile).
 */
export async function PATCH(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:me:preferences", user.id, API_WINDOWS.write);
    const body = await readJson(req);
    if (typeof body.digestOptOut !== "boolean") {
      throw new ApiError("VALIDATION", 422, "digestOptOut (booléen) requis.");
    }
    const fresh = await setDigestOptOut(user.id, body.digestOptOut);
    return withCache(apiOk(fresh), CACHE_PRIVATE);
  } catch (e) {
    return apiCatch(e, "api.me.preferences");
  }
}
