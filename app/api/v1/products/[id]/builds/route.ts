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
import { createBuild } from "@/services/builds.service";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Enregistrement d'un build APK (D1) : le binaire est DÉJÀ sur R2 (PUT
 * présigné direct). Ici on VÉRIFIE (HEAD : objet présent, taille exacte,
 * quota, confinement maker/produit) puis on insère en `pending` (revue
 * binaire bloquante en D4). Corps : `{ r2Key, sha256, sizeBytes,
 * versionCode?, versionName? }` (extraction manifest = D2).
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:builds:create", user.id, API_WINDOWS.write);
    const { id } = await context.params;
    const body = await readJson(req);
    if (
      typeof body.r2Key !== "string" ||
      typeof body.sha256 !== "string" ||
      typeof body.sizeBytes !== "number"
    ) {
      throw new ApiError("VALIDATION", 422, "r2Key, sha256 (string) et sizeBytes (number) requis.");
    }
    const rawCode: unknown = body.versionCode;
    const rawName: unknown = body.versionName;
    if (
      (rawCode !== undefined &&
        rawCode !== null &&
        (typeof rawCode !== "number" || !Number.isInteger(rawCode))) ||
      (rawName !== undefined && rawName !== null && typeof rawName !== "string")
    ) {
      throw new ApiError("VALIDATION", 422, "versionCode (int) / versionName (string) invalides.");
    }
    const versionCode: number | null = typeof rawCode === "number" ? rawCode : null;
    const versionName: string | null = typeof rawName === "string" ? rawName : null;
    const { id: buildId } = await createBuild({
      viewerId: user.id,
      productId: id,
      r2Key: body.r2Key,
      sha256: body.sha256,
      sizeBytes: body.sizeBytes,
      versionCode,
      versionName,
      whatsnew: typeof body.whatsnew === "string" ? body.whatsnew : null,
      // Métadonnées déclarées (le service assainit, D3 re-vérifie).
      package: typeof body.package === "string" ? body.package : null,
      minSdk: typeof body.minSdk === "number" ? body.minSdk : null,
      targetSdk: typeof body.targetSdk === "number" ? body.targetSdk : null,
      permissions: Array.isArray(body.permissions) ? body.permissions : null,
      certSha256: typeof body.certSha256 === "string" ? body.certSha256 : null,
      certSha1: typeof body.certSha1 === "string" ? body.certSha1 : null,
      sigScheme: typeof body.sigScheme === "string" ? body.sigScheme : null,
      certSubjectCn: typeof body.certSubjectCn === "string" ? body.certSubjectCn : null,
      certSubjectO: typeof body.certSubjectO === "string" ? body.certSubjectO : null,
      certKeyAlg: typeof body.certKeyAlg === "string" ? body.certKeyAlg : null,
      certKeyBits: typeof body.certKeyBits === "number" ? body.certKeyBits : null,
      certSigAlg: typeof body.certSigAlg === "string" ? body.certSigAlg : null,
    });
    return apiOk({ buildId }, 201);
  } catch (e) {
    return apiCatch(e, "api.builds.create");
  }
}
