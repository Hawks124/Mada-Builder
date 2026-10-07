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
    if (kind !== "logo" && kind !== "shot") {
      throw new ApiError("VALIDATION", 422, "Champ kind invalide (logo|shot).");
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
