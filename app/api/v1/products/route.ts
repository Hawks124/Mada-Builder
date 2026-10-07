import {
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  withCache,
  CACHE_PUBLIC_SHORT,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { MAX_PRODUCT_UPLOAD_BYTES, assertContentLength } from "@/lib/api/response";
import { idempotencyKeyFrom, withIdempotency } from "@/lib/api/idempotency";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/lib/api/pagination";
import { submitProduct } from "@/services/products.service";
import { getPublicProductsFeed } from "@/services/discover.service";
import { parseProductForm } from "./product-forms";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next).
export const PATCH = async () => methodNotAllowed(["GET", "POST"]);
export const PUT = async () => methodNotAllowed(["GET", "POST"]);
export const DELETE = async () => methodNotAllowed(["GET", "POST"]);

/**
 * Flux public mobile (4D) : nouveautés filtrables + recherche.
 * - sans `q` : keyset (`?cursor` opaque, `{ items, nextCursor }`) ;
 * - avec `q` : pertinence + `?page` (`{ items, nextCursor: null, page, total }`).
 * Filtres multi = params répétés (`?types=a&types=b`), comme le web.
 * Public, cache court ; rate-limit IP anonyme best-effort (pattern makers).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:products:feed", ip, { window: "60 s", max: 300 });
    }
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number.parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 50);
    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const feed = await getPublicProductsFeed({
      limit,
      page,
      cursor: decodeKeysetCursor(sp.get("cursor")),
      q: sp.get("q") ?? undefined,
      cat: sp.get("cat"),
      types: sp.getAll("types"),
      platforms: sp.getAll("platforms"),
      pricing: sp.getAll("pricing"),
      lifecycle: sp.getAll("lifecycle"),
      ages: sp.getAll("ages"),
    });
    return withCache(
      apiOk({
        items: feed.items,
        nextCursor: feed.nextCursor ? encodeKeysetCursor(feed.nextCursor) : null,
        ...(feed.page !== undefined ? { page: feed.page, total: feed.total } : {}),
      }),
      CACHE_PUBLIC_SHORT,
    );
  } catch (e) {
    return apiCatch(e, "api.products.feed");
  }
}

/**
 * Soumission mobile — même contrat que le formulaire web (multipart :
 * champs + `logo` + `screenshots` ≤ 6, `intent=publish|draft`, défaut
 * brouillon). Le service tranche pareil : Zod, liens revérifiés,
 * orientation pilotée par le type, uniformité, R2. Réponse = identité
 * (la fiche complète arrive en Phase 4 avec GET /[slug]).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:products:submit", user.id, API_WINDOWS.write);
    assertContentLength(req, MAX_PRODUCT_UPLOAD_BYTES);
    const fd = await req.formData();
    const { data, logo, screenshots, staged, asDraft } = parseProductForm(fd);
    // Retry mobile sans doublon (réseaux fluctuants) : même clé = replay.
    const res = await withIdempotency({
      userId: user.id,
      key: idempotencyKeyFrom(req),
      run: async () => ({
        status: 201,
        data: await submitProduct({ viewerId: user.id, data, logo, screenshots, staged, asDraft }),
      }),
    });
    return apiOk({ ...res.data, replayed: res.replayed }, res.status);
  } catch (e) {
    return apiCatch(e, "api.products.post");
  }
}
