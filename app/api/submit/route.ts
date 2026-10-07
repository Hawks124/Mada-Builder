import {
  ApiError,
  apiCatch,
  apiOk,
  assertContentLength,
  MAX_PRODUCT_UPLOAD_BYTES,
  corsPreflight,
  methodNotAllowed,
} from "@/lib/api/response";
import { getSessionUser } from "@/lib/supabase/server";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { idempotencyKeyFrom, withIdempotency } from "@/lib/api/idempotency";
import { submitProduct, updateProduct } from "@/services/products.service";
import { parseProductForm } from "@/app/api/v1/products/product-forms";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Soumission web (XHR + vrai %) — session cookies (pas Bearer : le web
 * n'a pas de token à mettre en header). MÊME parsing (`parseProductForm`)
 * et MÊME service que le mobile : une seule matrice de règles.
 * Réponse `{ id?, slug, status }` — le client redirige + toast (jamais
 * de redirect serveur ici : le XHR doit lire le résultat).
 * Clé d'idempotence générée par le client (anti double-envoi réseau).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) throw new ApiError("UNAUTHORIZED", 401, "Connexion requise.");
    await apiLimit("api:web:submit", sessionUser.id, API_WINDOWS.write);
    assertContentLength(req, MAX_PRODUCT_UPLOAD_BYTES);
    const fd = await req.formData();
    const { data, logo, screenshots, staged, asDraft } = parseProductForm(fd);
    const productIdRaw = fd.get("productId");
    const productId = typeof productIdRaw === "string" && productIdRaw !== "" ? productIdRaw : null;
    const res = await withIdempotency<{
      slug: string;
      status: string;
      rereview?: boolean;
      id?: string;
    }>({
      userId: sessionUser.id,
      key: idempotencyKeyFrom(req),
      run: async () => {
        if (productId) {
          // Édition : publish + draft → passage pending (publication depuis
          // l'édition, mêmes règles que la création). Sinon statut conservé.
          const publish = !asDraft;
          const updated = await updateProduct(
            sessionUser.id,
            productId,
            data,
            { logo, screenshots, staged },
            { publish },
          );
          return { status: 200, data: updated };
        }
        return {
          status: 201,
          data: await submitProduct({
            viewerId: sessionUser.id,
            data,
            logo,
            screenshots,
            staged,
            asDraft,
          }),
        };
      },
    });
    return apiOk({ ...res.data, replayed: res.replayed }, res.status);
  } catch (e) {
    return apiCatch(e, "api.web.submit");
  }
}
