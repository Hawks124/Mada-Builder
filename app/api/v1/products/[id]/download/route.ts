import { after } from "next/server";
import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  iso,
  methodNotAllowed,
  withCache,
  CACHE_PRIVATE,
} from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getApprovedBuilds, recordDownload } from "@/services/builds.service";
import { presignBuildDownload } from "@/lib/r2";

export const OPTIONS = async () => corsPreflight();
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);

async function resolvePublishedId(raw: string): Promise<string> {
  const key = (raw ?? "").toLowerCase().slice(0, 128);
  if (key === "") throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
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
 * Download natif (v1) : JSON au lieu de la 302 nue (`/api/products/[id]/
 * download`, gardée pour le web/QR). Dernier build approuvé d'une fiche
 * publiée — jamais un pending. Le natif suit `url` (300 s) puis VÉRIFIE
 * le SHA-256 après téléchargement (contrat install D4).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:download:detail", ip, { window: "60 s", max: 300 });
    }
    const { id: raw } = await ctx.params;
    const productId = await resolvePublishedId(raw);
    const [product] = await db
      .select({ id: products.id, status: products.status })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);
    if (!product || product.status !== "published") {
      throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
    }
    const builds = await getApprovedBuilds(product.id);
    const latest = builds[0];
    if (!latest) {
      throw new ApiError("NOT_FOUND", 404, "Aucun binaire vérifié pour ce produit.");
    }
    const url = await presignBuildDownload(latest.r2Key);
    // Compteur APRÈS tous les contrôles (404 = rien), écriture non bloquante.
    after(() => recordDownload(product.id));
    return withCache(
      apiOk({
        url,
        expiresIn: 300,
        versionCode: latest.versionCode,
        versionName: latest.versionName,
        package: latest.package,
        sha256: latest.sha256File,
        sizeBytes: latest.sizeBytes,
        reviewedAt: iso(latest.reviewedAt),
      }),
      CACHE_PRIVATE,
    );
  } catch (e) {
    return apiCatch(e, "api.download.detail");
  }
}
