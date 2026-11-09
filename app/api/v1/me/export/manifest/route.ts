import { apiCatch, apiOk, withCache, CACHE_PRIVATE } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { apiLimit } from "@/lib/api/ratelimit";
import { buildExportManifest } from "@/services/export.service";

/**
 * Manifest d'assemblage pour le client (desktop) : data.json + instructions
 * de fetch signées (CDN public, presign R2 GET 300 s, Supabase signed 15 min).
 * AUCUN ZIP construit — la route tient en <2 s même sur gros comptes.
 * AllowBanned (droit RGPD du banni). Contrat : docs/export-format.md.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:export:manifest", user.id, { window: "60 m", max: 6 });
    const manifest = await buildExportManifest(user.id);
    return withCache(apiOk(manifest), CACHE_PRIVATE);
  } catch (err) {
    return apiCatch(err, "api.v1.me.export.manifest");
  }
}
