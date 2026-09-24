import { ApiError, apiCatch, apiOk, corsPreflight, methodNotAllowed, requireFile } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { updateAvatar } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — upload uniquement.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);

/**
 * Upload avatar — multipart `avatar` (même contrat que le formulaire
 * web : sharp 512px WebP, magic-bytes, 128px min, 10 Mo, SVG interdit).
 * Service_role côté serveur (aucune clé côté mobile). L'ancien fichier
 * est purgé par le service (pas de bloat).
 *
 * NOTE plateforme : sur hébergement serverless (Vercel ~4,5 Mo de body),
 * les gros fichiers sont tronqués AVANT notre code — le mobile compresse
 * (< 2 Mo recommandé, voir docs/mobile-contrats.md), notre limite 10 Mo
 * reste le garde-fou serveur (self-hosted, retries).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:me:avatar", user.id, API_WINDOWS.file);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError("INVALID_BODY", 400, "Corps multipart invalide.");
    }
    const file = requireFile(form, "avatar");
    const admin = createAdminClient();
    const { avatarUrl } = await updateAvatar(admin, user.id, user.id, file);
    return apiOk({ avatarUrl });
  } catch (e) {
    return apiCatch(e, "api.me.avatar");
  }
}
