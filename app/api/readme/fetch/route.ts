import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { fetchVerifiedText } from "@/services/url-check.service";
import { resolveRawFile, resolveReadmeCandidates } from "@/lib/readme-import";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Fetch README (import description) : session REQUISE (jamais de
 * SSRF-as-a-service anonyme), allowlist d'hôtes + gardes SSRF
 * (`fetchVerifiedText`), `main` puis `master`. Retourne le markdown
 * BRUT + la base (le client sanitize + pré-remplit — le serveur
 * re-sanitize à la soumission).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("UNAUTHORIZED", 401, "Connexion requise.");
    await apiLimit("api:readme:fetch", user.id, { window: "60 s", max: 10 });
    const body = await readJson(req);
    const input = typeof body.url === "string" ? body.url : "";
    // Mode `raw` (licence) : fichier texte direct, pas de branches.
    if (body.mode === "raw") {
      const direct = resolveRawFile(input);
      if (!direct) {
        throw new ApiError(
          "VALIDATION",
          422,
          "URL non supportée — collez l'URL de la page du fichier (ex : https://github.com/user/repo/blob/main/LICENSE) ou son URL raw.",
        );
      }
      try {
        const text = await fetchVerifiedText(direct);
        return apiOk({ text, base: null });
      } catch (e) {
        throw new ApiError(
          "VALIDATION",
          422,
          e instanceof Error ? e.message : "Récupération impossible.",
        );
      }
    }
    const resolved = resolveReadmeCandidates(input);
    if (!resolved) {
      throw new ApiError(
        "VALIDATION",
        422,
        "URL non supportée (dépôt GitHub/GitLab/Bitbucket/Codeberg ou raw directe).",
      );
    }
    let lastError = "README introuvable.";
    for (const url of resolved.urls) {
      try {
        const markdown = await fetchVerifiedText(url);
        return apiOk({ markdown, base: resolved.base });
      } catch (e) {
        lastError = e instanceof Error ? e.message : lastError;
      }
    }
    throw new ApiError("VALIDATION", 422, lastError);
  } catch (e) {
    return apiCatch(e, "api.readme.fetch");
  }
}
