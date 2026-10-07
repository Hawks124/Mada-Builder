import {
  apiCatch,
  apiOk,
  CACHE_PUBLIC_SHORT,
  corsPreflight,
  methodNotAllowed,
  readJson,
  withCache,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { getProductReviews, upsertReview } from "@/services/feedback.service";

export const OPTIONS = async () => corsPreflight();
export const PATCH = async () => methodNotAllowed(["GET", "POST"]);
export const PUT = async () => methodNotAllowed(["GET", "POST"]);
export const DELETE = async () => methodNotAllowed(["GET", "POST"]);

/** Avis : lecture publique (cache court) + création/modification (Bearer). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:reviews:read", ip, { window: "60 s", max: 300 });
    }
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
      50,
    );
    let viewerId: string | null = null;
    try {
      viewerId = (await requireApiUser(req)).id;
    } catch {
      viewerId = null;
    }
    const data = await getProductReviews(id, viewerId, limit);
    return withCache(apiOk(data), CACHE_PUBLIC_SHORT);
  } catch (e) {
    return apiCatch(e, "api.reviews.get");
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:reviews:write", user.id, API_WINDOWS.write);
    const { id } = await ctx.params;
    const body = await readJson(req);
    const data = await upsertReview({
      viewerId: user.id,
      productId: id,
      rating: typeof body.rating === "number" ? body.rating : NaN,
      body: typeof body.body === "string" ? body.body : "",
    });
    return apiOk(data, 201);
  } catch (e) {
    return apiCatch(e, "api.reviews.post");
  }
}
