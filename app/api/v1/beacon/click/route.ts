import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { logOutboundClick } from "@/services/products.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next) — le contrat, c'est POST.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Beacon clics sortants — anonyme (pas de Bearer, pas de user_id : les
 * clics ne sont pas des données personnelles), best-effort (toujours 200,
 * jamais bloquant pour la navigation). Rate-limit IP large (anti-burst).
 * Corps : `{ productId, target }` (target = field-id matrice).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    await apiLimit("api:beacon:click", ip, API_WINDOWS.write);
    const body = await readJson(req);
    const productId = typeof body.productId === "string" ? body.productId : "";
    const target = typeof body.target === "string" ? body.target : "";
    if (productId !== "" && target !== "") {
      await logOutboundClick({ productId, target });
    }
    return apiOk({ ok: true });
  } catch (e) {
    return apiCatch(e, "api.beacon.click.post");
  }
}
