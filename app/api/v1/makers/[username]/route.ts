import { ApiError, apiCatch, apiOk, corsPreflight, iso, methodNotAllowed } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { fetchUserProfile } from "@/services/users.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — annuaire public en lecture seule.
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);

/**
 * Profil maker public — miroir EXACT de la page web (même service,
 * même allowlist : jamais l'email, jamais le motif ; `bannedAt` présent
 * pour le badge "Suspendu"). PAS d'auth requise (annuaire public).
 * Inconnu → 404 (même forme qu'un slug inexistant : pas d'oracle).
 * `username` insensible à la casse (service lowercases).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  try {
    // Rate-limit anonyme par IP best-effort (spoofable, fail-open :
    // anti-burst, pas anti-abus fin ; l'anti-abus fin vit sur les
    // routes authentifiées par user id). IP illisible → on SAUTE la
    // limite plutôt que de partager un bucket commun (un acteur sans
    // header affamerait les autres — pire que pas de limite).
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:makers:read", ip, {
        window: "60 s",
        max: 300,
      });
    }
    const { username } = await context.params;
    if (!username || username.length > 64) {
      throw new ApiError("NOT_FOUND", 404, "Profil introuvable.");
    }
    const row = await fetchUserProfile(username);
    if (!row) throw new ApiError("NOT_FOUND", 404, "Profil introuvable.");
    return apiOk({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      occupation: row.occupation,
      websiteUrl: row.websiteUrl,
      socialLinks: row.socialLinks,
      country: row.country,
      city: row.city,
      bannedAt: iso(row.bannedAt),
      createdAt: iso(row.createdAt),
    });
  } catch (e) {
    return apiCatch(e, "api.makers.get");
  }
}
