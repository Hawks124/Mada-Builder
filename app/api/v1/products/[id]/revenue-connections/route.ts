import {
  apiCatch,
  apiOk,
  ApiError,
  corsPreflight,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  connectRevenueConnection,
  getProductRevenueStatus,
  revokeMyProductConnection,
} from "@/services/revenue/connections";
import { ProfileError } from "@/services/users.service";
import { REVENUE_PROVIDER_IDS, type RevenueProviderId } from "@/services/revenue/types";

export const OPTIONS = async () => corsPreflight();
export const PATCH = async () => methodNotAllowed(["GET", "POST", "DELETE"]);
export const PUT = async () => methodNotAllowed(["GET", "POST", "DELETE"]);

async function resolveOwnedProductId(userId: string, raw: string): Promise<string> {
  const key = (raw ?? "").toLowerCase().slice(0, 128);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
  const [found] = await db
    .select({ id: products.id, makerId: products.makerId })
    .from(products)
    .where(and(isUuid ? eq(products.id, key) : eq(products.slug, key), isNull(products.deletedAt)))
    .limit(1);
  if (!found || found.makerId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
  }
  return found.id;
}

/**
 * Connexions revenus maker (BÊTA) : statut sans clé (GET), connexion
 * (POST, probe + chiffrement, 5/h), révocation (DELETE, clé purgée).
 * La clé ne transite qu'au POST, chiffrée aussitôt, jamais relue.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    const { id: raw } = await ctx.params;
    const productId = await resolveOwnedProductId(user.id, raw);
    const status = await getProductRevenueStatus(productId);
    if (!status) throw new ApiError("NOT_FOUND", 404, "Aucune connexion.");
    return apiOk(status);
  } catch (e) {
    return apiCatch(e, "api.revenue-connections.get");
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:revenue:connect", user.id, { window: "1 h", max: 5 });
    const { id: raw } = await ctx.params;
    const productId = await resolveOwnedProductId(user.id, raw);
    const body = await readJson(req);
    const rawProvider = typeof body.provider === "string" ? body.provider : "";
    if (!(REVENUE_PROVIDER_IDS as string[]).includes(rawProvider)) {
      throw new ApiError("VALIDATION", 422, "Provider inconnu.");
    }
    const key = typeof body.key === "string" ? body.key : "";
    const config: Record<string, string> =
      body.config && typeof body.config === "object"
        ? Object.fromEntries(
            Object.entries(body.config as Record<string, unknown>)
              .filter((e): e is [string, string] => typeof e[1] === "string")
              .slice(0, 5),
          )
        : {};
    const displayMode = body.displayMode === "badge_only" ? "badge_only" : "full";
    try {
      const res = await connectRevenueConnection(user.id, {
        productId,
        provider: rawProvider as RevenueProviderId,
        key,
        config,
        displayMode,
      });
      return apiOk(res, 201);
    } catch (e) {
      if (e instanceof ProfileError) throw new ApiError("VALIDATION", 422, e.message);
      throw e;
    }
  } catch (e) {
    return apiCatch(e, "api.revenue-connections.post");
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:revenue:write", user.id, API_WINDOWS.write);
    const { id: raw } = await ctx.params;
    const productId = await resolveOwnedProductId(user.id, raw);
    try {
      await revokeMyProductConnection(user.id, productId);
    } catch {
      throw new ApiError("NOT_FOUND", 404, "Aucune connexion.");
    }
    return apiOk({ revoked: true });
  } catch (e) {
    return apiCatch(e, "api.revenue-connections.delete");
  }
}
