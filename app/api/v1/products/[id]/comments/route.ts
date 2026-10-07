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
import { addComment, getProductComments } from "@/services/feedback.service";

export const OPTIONS = async () => corsPreflight();
export const PATCH = async () => methodNotAllowed(["GET", "POST"]);
export const PUT = async () => methodNotAllowed(["GET", "POST"]);
export const DELETE = async () => methodNotAllowed(["GET", "POST"]);

/** Commentaires : lecture publique (cache court) + ajout (Bearer). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:comments:read", ip, { window: "60 s", max: 300 });
    }
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 1),
      100,
    );
    let viewerId: string | null = null;
    try {
      viewerId = (await requireApiUser(req)).id;
    } catch {
      viewerId = null;
    }
    const items = await getProductComments(id, viewerId, limit);
    return withCache(apiOk({ items }), CACHE_PUBLIC_SHORT);
  } catch (e) {
    return apiCatch(e, "api.comments.get");
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:comments:write", user.id, API_WINDOWS.write);
    const { id } = await ctx.params;
    const body = await readJson(req);
    const data = await addComment({
      viewerId: user.id,
      productId: id,
      body: typeof body.body === "string" ? body.body : "",
      parentId: typeof body.parentId === "string" ? body.parentId : null,
    });
    return apiOk(data, 201);
  } catch (e) {
    return apiCatch(e, "api.comments.post");
  }
}
