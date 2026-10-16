import {
  ApiError,
  CACHE_PUBLIC_SHORT,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  withCache,
} from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import {
  countPublishingMakers,
  listRecentMakers,
  listTrendingMakers,
} from "@/services/makers.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — annuaire public en lecture seule.
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);

/**
 * Bandeau makers du hero (mobile + web) : `?limit=5&sort=recent`
 * (défauts) ou `sort=trending` (votes pondérés reçus, 30 j glissants,
 * `score` inclus = « + combien »). Même allowlist que le détail :
 * username/displayName/avatarUrl seuls, bannis/supprimés exclus.
 * `total` = vivier du tri (recent : makers publiés ; trending :
 * makers votés sur 30 j). PAS d'auth (annuaire public), cache court,
 * rate-limit IP anonyme best-effort (pattern makers).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:makers:read", ip, {
        window: "60 s",
        max: 300,
      });
    }
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number.parseInt(sp.get("limit") ?? "5", 10) || 5, 1), 20);
    const sort = sp.get("sort") ?? "recent";
    if (sort === "recent") {
      const [items, total] = await Promise.all([listRecentMakers(limit), countPublishingMakers()]);
      return withCache(apiOk({ items, total, sort }), CACHE_PUBLIC_SHORT);
    }
    if (sort === "trending") {
      const { items, total } = await listTrendingMakers(limit);
      return withCache(apiOk({ items, total, sort, windowDays: 30 }), CACHE_PUBLIC_SHORT);
    }
    throw new ApiError("VALIDATION", 422, "Tri inconnu (recent|trending).");
  } catch (e) {
    return apiCatch(e, "api.makers.list");
  }
}
