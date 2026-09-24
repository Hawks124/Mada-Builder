import { ApiError, apiCatch, apiOk, corsPreflight, methodNotAllowed } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import {
  APPEAL_MAX_BYTES,
  APPEAL_MAX_FILES,
  submitAppeal,
  type AppealFile,
} from "@/services/appeals.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — dépôt uniquement (le statut vit à /appeals/mine).
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);

/**
 * Dépôt d'appel — multipart : `explanation` (texte, ≥ 10 caractères,
 * validé par le service) + `evidence` répété (0–3 fichiers, 10 Mo max,
 * PNG/JPG/WebP/PDF vérifiés magic-bytes — SVG/exécutables refusés).
 * Mêmes verrous que le web : banni seul (service), pending unique,
 * 24 h entre dépôts. Réponse = `{ appealId, seq }` + message
 * "Appel nºX envoyé." (même numéro que le panel admin).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:appeals:submit", user.id, API_WINDOWS.file);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError("INVALID_BODY", 400, "Corps multipart invalide.");
    }
    const rawExplanation = form.get("explanation");
    const explanation = typeof rawExplanation === "string" ? rawExplanation : "";
    const raws = form.getAll("evidence").filter((v): v is File => v instanceof File && v.size > 0);
    if (raws.length > APPEAL_MAX_FILES) {
      throw new ApiError("VALIDATION", 422, `${APPEAL_MAX_FILES} pièces maximum.`);
    }
    const files: AppealFile[] = [];
    for (const f of raws) {
      if (f.size > APPEAL_MAX_BYTES) {
        throw new ApiError("FILE_REJECTED", 422, "Pièce trop lourde (10 Mo max).");
      }
      files.push({ buffer: Buffer.from(await f.arrayBuffer()), size: f.size });
    }
    const admin = createAdminClient();
    const { appealId, seq } = await submitAppeal({
      supabase: admin,
      viewerId: user.id,
      explanation,
      files,
    });
    return apiOk({ appealId, seq }, 201);
  } catch (e) {
    return apiCatch(e, "api.appeals.submit");
  }
}
