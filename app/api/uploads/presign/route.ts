import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { getSessionUser } from "@/lib/supabase/server";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  listMultipartParts,
  presignBuildUpload,
  presignMultipartPart,
  r2Configured,
} from "@/lib/r2";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Upload présigné APK côté web (D1, session cookies — le web n'a pas de
 * Bearer) : même contrat que la route mobile (`kind: "apk"`). Le client
 * PUT le binaire DIRECTEMENT sur R2 puis créera le build (D2). Quota
 * 300 Mo + type APK vérifiés AVANT signature ; clé confinée à
 * `builds/{maker}/{produit}/` ; validité 15 min.
 * Corps : `{ productId, contentLength }`.
 *
 * Multipart resumable (D6) : `{ multipart: { action, ... } }` — `create`
 * (ouvre la session), `part` (URL d'une part), `parts` (reprise : parts
 * reçues), `complete` (compose l'objet), `abort` (abandon). Même
 * confinement, mêmes quotas ; le record + re-vérif existants prennent
 * le relais sur l'objet composé (inchangés).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) throw new ApiError("UNAUTHORIZED", 401, "Connexion requise.");
    await apiLimit("api:web:uploads:presign", sessionUser.id, API_WINDOWS.write);
    if (!r2Configured()) {
      throw new ApiError("INTERNAL", 500, "Stockage indisponible pour le moment.");
    }
    const body = await readJson(req);
    if (body.multipart !== undefined) {
      return handleMultipart(body.multipart, sessionUser.id);
    }
    if (typeof body.productId !== "string" || typeof body.contentLength !== "number") {
      throw new ApiError("VALIDATION", 422, "productId (string) et contentLength (number) requis.");
    }
    try {
      const { url, key } = await presignBuildUpload({
        makerId: sessionUser.id,
        productId: body.productId,
        contentLength: body.contentLength,
      });
      return apiOk({ url, key, expiresIn: 900 });
    } catch (e) {
      throw new ApiError("FILE_REJECTED", 422, e instanceof Error ? e.message : "Fichier refusé.");
    }
  } catch (e) {
    return apiCatch(e, "api.web.uploads.presign");
  }
}

async function handleMultipart(mp: unknown, makerId: string): Promise<Response> {
  if (!mp || typeof mp !== "object" || Array.isArray(mp)) {
    throw new ApiError("VALIDATION", 422, "Bloc multipart invalide.");
  }
  const m = mp as Record<string, unknown>;
  try {
    switch (m.action) {
      case "create": {
        if (typeof m.productId !== "string" || typeof m.contentLength !== "number") {
          throw new ApiError(
            "VALIDATION",
            422,
            "productId (string) et contentLength (number) requis.",
          );
        }
        const { uploadId, key } = await createMultipartUpload({
          makerId,
          productId: m.productId,
          contentLength: m.contentLength,
        });
        return apiOk({ uploadId, key, expiresIn: 900 });
      }
      case "part": {
        if (typeof m.productId !== "string" || typeof m.key !== "string") {
          throw new ApiError("VALIDATION", 422, "productId, key et uploadId requis.");
        }
        if (typeof m.uploadId !== "string" || typeof m.partNumber !== "number") {
          throw new ApiError("VALIDATION", 422, "uploadId (string) et partNumber (int) requis.");
        }
        const { url } = await presignMultipartPart({
          makerId,
          productId: m.productId,
          key: m.key,
          uploadId: m.uploadId,
          partNumber: m.partNumber,
        });
        return apiOk({ url, expiresIn: 900 });
      }
      case "parts": {
        if (
          typeof m.productId !== "string" ||
          typeof m.key !== "string" ||
          typeof m.uploadId !== "string"
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key et uploadId requis.");
        }
        const parts = await listMultipartParts({
          makerId,
          productId: m.productId,
          key: m.key,
          uploadId: m.uploadId,
        });
        return apiOk({ parts });
      }
      case "complete": {
        if (
          typeof m.productId !== "string" ||
          typeof m.key !== "string" ||
          typeof m.uploadId !== "string" ||
          !Array.isArray(m.parts)
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key, uploadId et parts[] requis.");
        }
        const parts = m.parts
          .filter(
            (p): p is { n: number; etag: string } =>
              !!p &&
              typeof p === "object" &&
              typeof (p as { n?: unknown }).n === "number" &&
              typeof (p as { etag?: unknown }).etag === "string",
          )
          .map((p) => ({ n: p.n, etag: p.etag, size: 0 }));
        await completeMultipartUpload({
          makerId,
          productId: m.productId,
          key: m.key,
          uploadId: m.uploadId,
          parts,
        });
        return apiOk({ ok: true });
      }
      case "abort": {
        if (
          typeof m.productId !== "string" ||
          typeof m.key !== "string" ||
          typeof m.uploadId !== "string"
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key et uploadId requis.");
        }
        await abortMultipartUpload({
          makerId,
          productId: m.productId,
          key: m.key,
          uploadId: m.uploadId,
        });
        return apiOk({ ok: true });
      }
      default:
        throw new ApiError(
          "VALIDATION",
          422,
          "Action multipart invalide (create|part|parts|complete|abort).",
        );
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("FILE_REJECTED", 422, e instanceof Error ? e.message : "Fichier refusé.");
  }
}
