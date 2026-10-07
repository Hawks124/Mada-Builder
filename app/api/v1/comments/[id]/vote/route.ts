import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { idempotencyKeyFrom, withIdempotency } from "@/lib/api/idempotency";
import { toggleCommentVote } from "@/services/feedback.service";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/** Vote commentaire +1/-1 (toggle, idempotent par clé comme les votes). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:comments:vote", user.id, API_WINDOWS.write);
    const { id } = await ctx.params;
    const body = await readJson(req);
    const value = body.value === "down" ? "down" : "up";
    const res = await withIdempotency({
      userId: user.id,
      key: idempotencyKeyFrom(req),
      run: async () => ({
        status: 200,
        data: await toggleCommentVote({ viewerId: user.id, commentId: id, value }),
      }),
    });
    return apiOk({ ...res.data, replayed: res.replayed }, res.status);
  } catch (e) {
    return apiCatch(e, "api.comments.vote.post");
  }
}
