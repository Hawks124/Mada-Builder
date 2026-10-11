import { ApiError, apiCatch } from "@/lib/api/response";
import { getSessionUser } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/ratelimit";
import { ProfileError } from "@/services/users.service";
import { streamUserExport } from "@/services/export.service";

/**
 * Export RGPD web (légal §Mes droits) : ZIP streamé (data.json + médias
 * + APKs + MANIFEST), téléchargement direct. Session cookies (le web
 * n'a pas de Bearer). Rate-limit 3/h (egress R2 par demande).
 */
export async function GET(): Promise<Response> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) throw new ApiError("UNAUTHORIZED", 401, "Connexion requise.");
    const { allowed } = await checkLimit({
      namespace: "me:export",
      id: sessionUser.id,
      window: { window: "60 m", max: 3 },
    });
    if (!allowed)
      throw new ApiError("FORBIDDEN", 429, "Trop de demandes. Réessayez dans une heure.");
    const { filename, stream } = await streamUserExport(sessionUser.id);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ProfileError) return apiCatch(e, "api.me.export");
    return apiCatch(e, "api.me.export");
  }
}
