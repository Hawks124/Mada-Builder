import { apiCatch, apiOk, corsPreflight, methodNotAllowed } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { idempotencyKeyFrom, withIdempotency } from "@/lib/api/idempotency";
import { toggleVote } from "@/services/votes.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next) — le contrat, c'est POST.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Vote mobile — même `toggleVote` que le web (1/user, réversible,
 * shadow-weighting, rate-limits). Réponse = état frais (l'UI optimiste
 * se réconcilie dessus, pas de refetch).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:products:vote", user.id, API_WINDOWS.write);
    const { id } = await ctx.params;
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    // Retry sans double-toggle : le toggle n'est pas idempotent par nature
    // (voter→revoter), la clé fige le 1er effet et rejoue sa réponse.
    const res = await withIdempotency({
      userId: user.id,
      key: idempotencyKeyFrom(req),
      run: async () => ({
        status: 200,
        data: await toggleVote({ viewerId: user.id, productId: id, ip }),
      }),
    });
    return apiOk({ ...res.data, replayed: res.replayed }, res.status);
  } catch (e) {
    return apiCatch(e, "api.products.vote.post");
  }
}
