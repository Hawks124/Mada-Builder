import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import {
  PRODUCT_LOGOS_BUCKET,
  PRODUCT_SHOTS_BUCKET,
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  listMultipartParts,
  presignBuildUpload,
  presignMultipartPart,
  presignStagingUpload,
  r2Configured,
  type R2Bucket,
} from "@/lib/r2";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next) — le contrat, c'est POST.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Upload présigné staging (Phase 6) : le mobile PUT le brut DIRECTEMENT
 * sur R2 (zéro RAM serveur), puis soumet les clés (`stagedLogo`,
 * `stagedScreenshots`). Taille + type vérifiés AVANT signature ; clé
 * confinée à `staging/{maker}/` (jamais d'écriture ailleurs) ; validité
 * 10 min. Corps : `{ kind: "logo"|"shot", contentType, contentLength }`.
 * Builds APK (D1) : `{ kind: "apk", productId, contentLength }` (type
 * imposé APK, quota 300 Mo, clé `builds/{maker}/{produit}/`, 15 min).
 * Multipart resumable (D6) : `{ kind: "apk-multipart", action, ... }` —
 * `create` (ouvre la session), `part` (URL d'une part), `parts` (reprise),
 * `complete` (compose), `abort` (abandon). Même confinement, mêmes
 * quotas ; le record + re-vérif existants prennent le relais (inchangés).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:uploads:presign", user.id, API_WINDOWS.write);
    if (!r2Configured()) {
      throw new ApiError("INTERNAL", 500, "Stockage indisponible pour le moment.");
    }
    const body = await readJson(req);
    const kind = body.kind;
    if (kind === "apk") {
      const productId = body.productId;
      const contentLength = body.contentLength;
      if (typeof productId !== "string" || typeof contentLength !== "number") {
        throw new ApiError(
          "VALIDATION",
          422,
          "productId (string) et contentLength (number) requis.",
        );
      }
      try {
        const { url, key } = await presignBuildUpload({
          makerId: user.id,
          productId,
          contentLength,
        });
        return apiOk({ url, key, expiresIn: 900 });
      } catch (e) {
        throw new ApiError(
          "FILE_REJECTED",
          422,
          e instanceof Error ? e.message : "Fichier refusé.",
        );
      }
    }
    if (kind === "apk-multipart") {
      return handleApkMultipart(body, user.id);
    }
    if (kind !== "logo" && kind !== "shot") {
      throw new ApiError("VALIDATION", 422, "Champ kind invalide (logo|shot|apk|apk-multipart).");
    }
    const contentType = body.contentType;
    const contentLength = body.contentLength;
    if (typeof contentType !== "string" || typeof contentLength !== "number") {
      throw new ApiError(
        "VALIDATION",
        422,
        "contentType (string) et contentLength (number) requis.",
      );
    }
    const bucket: R2Bucket = kind === "logo" ? PRODUCT_LOGOS_BUCKET : PRODUCT_SHOTS_BUCKET;
    try {
      const { url, key } = await presignStagingUpload({
        bucket,
        makerId: user.id,
        contentType,
        contentLength,
      });
      return apiOk({ url, key, bucket, expiresIn: 600 });
    } catch (e) {
      throw new ApiError("FILE_REJECTED", 422, e instanceof Error ? e.message : "Fichier refusé.");
    }
  } catch (e) {
    return apiCatch(e, "api.uploads.presign.post");
  }
}

async function handleApkMultipart(
  body: Record<string, unknown>,
  makerId: string,
): Promise<Response> {
  try {
    switch (body.action) {
      case "create": {
        if (typeof body.productId !== "string" || typeof body.contentLength !== "number") {
          throw new ApiError(
            "VALIDATION",
            422,
            "productId (string) et contentLength (number) requis.",
          );
        }
        const { uploadId, key } = await createMultipartUpload({
          makerId,
          productId: body.productId,
          contentLength: body.contentLength,
        });
        return apiOk({ uploadId, key, expiresIn: 900 });
      }
      case "part": {
        if (
          typeof body.productId !== "string" ||
          typeof body.key !== "string" ||
          typeof body.uploadId !== "string" ||
          typeof body.partNumber !== "number"
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key, uploadId et partNumber requis.");
        }
        const { url } = await presignMultipartPart({
          makerId,
          productId: body.productId,
          key: body.key,
          uploadId: body.uploadId,
          partNumber: body.partNumber,
        });
        return apiOk({ url, expiresIn: 900 });
      }
      case "parts": {
        if (
          typeof body.productId !== "string" ||
          typeof body.key !== "string" ||
          typeof body.uploadId !== "string"
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key et uploadId requis.");
        }
        const parts = await listMultipartParts({
          makerId,
          productId: body.productId,
          key: body.key,
          uploadId: body.uploadId,
        });
        return apiOk({ parts });
      }
      case "complete": {
        if (
          typeof body.productId !== "string" ||
          typeof body.key !== "string" ||
          typeof body.uploadId !== "string" ||
          !Array.isArray(body.parts)
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key, uploadId et parts[] requis.");
        }
        const parts = body.parts
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
          productId: body.productId,
          key: body.key,
          uploadId: body.uploadId,
          parts,
        });
        return apiOk({ ok: true });
      }
      case "abort": {
        if (
          typeof body.productId !== "string" ||
          typeof body.key !== "string" ||
          typeof body.uploadId !== "string"
        ) {
          throw new ApiError("VALIDATION", 422, "productId, key et uploadId requis.");
        }
        await abortMultipartUpload({
          makerId,
          productId: body.productId,
          key: body.key,
          uploadId: body.uploadId,
        });
        return apiOk({ ok: true });
      }
      default:
        throw new ApiError(
          "VALIDATION",
          422,
          "Action invalide (create|part|parts|complete|abort).",
        );
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("FILE_REJECTED", 422, e instanceof Error ? e.message : "Fichier refusé.");
  }
}
