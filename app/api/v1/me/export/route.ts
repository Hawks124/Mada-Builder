import { ApiError, apiCatch } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { apiLimit } from "@/lib/api/ratelimit";
import { streamUserExport } from "@/services/export.service";

/**
 * Export RGPD mobile (même contrat que la route web) : ZIP streamé,
 * Bearer obligatoire. Rate-limit 3/h (egress R2 par demande).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:export", user.id, { window: "60 m", max: 3 });
    const { filename, stream } = await streamUserExport(user.id);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return apiCatch(e, "api.v1.me.export");
    return apiCatch(e, "api.v1.me.export");
  }
}
