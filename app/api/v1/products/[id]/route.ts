import {
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  withCache,
  CACHE_PUBLIC_SHORT,
  ApiError,
  iso,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { MAX_PRODUCT_UPLOAD_BYTES, assertContentLength } from "@/lib/api/response";
import { fetchProductBySlug, updateProduct } from "@/services/products.service";
import { parseProductForm } from "../product-forms";
import { getUserVotedIds } from "@/services/votes.service";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next).
export const POST = async () => methodNotAllowed(["GET", "PATCH"]);
export const PUT = async () => methodNotAllowed(["GET", "PATCH"]);
export const DELETE = async () => methodNotAllowed(["GET", "PATCH"]);

/**
 * Fiche publique mobile (4D) : `GET /products/[id|slug]` (le segment est
 * partagé avec PATCH — Next interdit deux dynamiques au même niveau).
 * UUID → résolution slug puis fiche ; sinon slug direct. `voted` inclus
 * seulement avec Bearer valide (sans token : `false` ; token invalide :
 * traité comme absent — le vote exigera un token valide).
 * Inconnu/dépublié → 404 (même forme que makers : pas d'oracle).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:products:detail", ip, { window: "60 s", max: 300 });
    }
    const { id: raw } = await ctx.params;
    const key = (raw ?? "").toLowerCase().slice(0, 128);
    if (key === "") throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
    let slug = key;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) {
      const [found] = await db
        .select({ slug: products.slug })
        .from(products)
        .where(
          and(eq(products.id, key), eq(products.status, "published"), isNull(products.deletedAt)),
        )
        .limit(1);
      if (!found) throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
      slug = found.slug;
    }
    const row = await fetchProductBySlug(slug);
    if (!row) throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
    let voted = false;
    try {
      const user = await requireApiUser(req);
      voted = (await getUserVotedIds(user.id, [row.id])).has(row.id);
    } catch {
      voted = false;
    }
    return withCache(
      apiOk({
        id: row.id,
        slug: row.slug,
        name: row.name,
        tagline: row.tagline,
        description: row.description,
        category: row.category,
        categories: row.categories,
        tags: row.tags,
        productType: row.productType,
        platforms: row.platforms,
        audience: row.audience,
        pricingModel: row.pricingModel,
        lifecycle: row.lifecycle,
        license: row.license,
        installCommand: row.installCommand,
        version: row.version,
        requirements: row.requirements,
        hasAds: row.hasAds,
        hasInAppPurchase: row.hasInAppPurchase,
        sharesData: row.sharesData,
        targetCountries: row.targetCountries,
        languagesSupported: row.languagesSupported,
        links: row.links,
        galleryOrientation: row.galleryOrientation,
        iconUrl: row.iconUrl,
        screenshots: row.screenshots,
        upvoteCount: row.upvoteCount,
        score: row.score,
        publishedAt: iso(row.publishedAt),
        maker: {
          username: row.makerUsername,
          displayName: row.makerDisplayName,
          avatarUrl: row.makerAvatarUrl,
        },
        voted,
      }),
      CACHE_PUBLIC_SHORT,
    );
  } catch (e) {
    return apiCatch(e, "api.products.detail");
  }
}

/**
 * Édition mobile — champs partiels (absent = conservé, jamais effacé),
 * fichiers = remplacement total (absents = conservés). Mêmes règles
 * re-revue que le web (nom/liens d'une fiche published → pending).
 * Réponse = slug + statut frais (pas de refetch côté mobile).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:products:update", user.id, API_WINDOWS.write);
    assertContentLength(req, MAX_PRODUCT_UPLOAD_BYTES);
    const { id } = await ctx.params;
    const fd = await req.formData();
    const { data, logo, screenshots, staged } = parseProductForm(fd);
    const res = await updateProduct(user.id, id, data, { logo, screenshots, staged });
    return apiOk(res);
  } catch (e) {
    return apiCatch(e, "api.products.patch");
  }
}
