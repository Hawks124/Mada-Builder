import {
  apiCatch,
  apiOk,
  ApiError,
  CACHE_PUBLIC_SHORT,
  corsPreflight,
  methodNotAllowed,
  withCache,
} from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getProductRevenueView } from "@/services/revenue/views";

export const OPTIONS = async () => corsPreflight();
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);

async function resolveProductId(raw: string): Promise<string> {
  const key = (raw ?? "").toLowerCase().slice(0, 128);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) return key;
  const [found] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(eq(products.slug, key), eq(products.status, "published"), isNull(products.deletedAt)),
    )
    .limit(1);
  if (!found) throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
  return found.id;
}

/**
 * Revenus vérifiés publics (BÊTA) : agrégats seuls (MRR, devise, abonnés,
 * courbe 90 j) — jamais la clé, jamais de PII. Sans connexion : 404
 * (même forme que makers : pas d'oracle).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:revenue:read", ip, { window: "60 s", max: 300 });
    }
    const { id: raw } = await ctx.params;
    const productId = await resolveProductId(raw);
    const view = await getProductRevenueView(productId);
    if (!view) throw new ApiError("NOT_FOUND", 404, "Revenus non vérifiés.");
    return withCache(apiOk(view), CACHE_PUBLIC_SHORT);
  } catch (e) {
    return apiCatch(e, "api.revenue.get");
  }
}
