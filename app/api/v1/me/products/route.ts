import {
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  withCache,
  CACHE_PRIVATE,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/lib/api/pagination";
import { fetchMyProducts } from "@/services/products.service";
import { serializeMyProduct } from "../../products/product-forms";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next) — le contrat, c'est GET.
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);

/**
 * Mes produits (tous statuts, brouillons inclus) — miroir du dashboard
 * web, dates ISO. Pagination curseur (`limit` 1-50 défaut 20, `cursor`
 * opaque) : jamais de liste non bornée. Lecture autorisée même banni
 * (comme le dashboard).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:products", user.id, API_WINDOWS.read);
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
      50,
    );
    const cursor = decodeKeysetCursor(url.searchParams.get("cursor"));
    const { items, nextCursor } = await fetchMyProducts(user.id, { limit, cursor });
    return withCache(
      apiOk({
        items: items.map(serializeMyProduct),
        nextCursor: nextCursor
          ? encodeKeysetCursor({ at: nextCursor.at.toISOString(), id: nextCursor.id })
          : null,
      }),
      CACHE_PRIVATE,
    );
  } catch (e) {
    return apiCatch(e, "api.me.products.get");
  }
}
