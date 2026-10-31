import { after } from "next/server";
import { ApiError, apiCatch, methodNotAllowed } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getApprovedBuilds, recordDownload } from "@/services/builds.service";
import { presignBuildDownload } from "@/lib/r2";

export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);

/**
 * Téléchargement APK (D5, public) : 302 vers une URL GET signée courte
 * (bucket privé, jamais d'URL directe). Toujours le DERNIER build
 * approuvé — jamais un pending (matrice 2×2). Fiche non publiée ou
 * sans build approuvé → 404 honnête. Le mobile vérifie le SHA-256
 * (`sha256_file`) après téléchargement (contrat install D4).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // Rate-limit IP (lot B) : cette route historique servait et comptait
    // sans aucune garde — même fenêtre que la v1 (burst légitime large,
    // flood stoppé). Sans fiable x-forwarded-for : sans limite (fail-open
    // coherente avec la façade Upstash).
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip) {
      await apiLimit("api:products:download", ip, { window: "60 s", max: 300 });
    }
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError("NOT_FOUND", 404, "Produit introuvable.");
    }
    const [product] = await db
      .select({ id: products.id, status: products.status })
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
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
    // Compteur APRÈS tous les contrôles : un 404 ne compte pas, et
    // l'écriture après réponse est suivie par Next.js.
    after(() => recordDownload(product.id));
    // 302 manuel (pas `redirect()` : apiCatch avalerait son throw).
    return Response.redirect(url, 302);
  } catch (e) {
    return apiCatch(e, "api.products.download");
  }
}
