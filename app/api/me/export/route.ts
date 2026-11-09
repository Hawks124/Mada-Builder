import { ApiError, apiCatch } from "@/lib/api/response";
import { getSessionUser } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/ratelimit";
import { ProfileError } from "@/services/users.service";
import { buildUserExport } from "@/services/export.service";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";

/**
 * Export RGPD web : ZIP complet en tmpfile puis streamed avec
 * Content-Length exact — jamais une archive partielle côté client.
 */
export async function GET(request: Request): Promise<Response> {
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
    const { filename, tempPath, size } = await buildUserExport(sessionUser.id);
    const stream = createReadStream(tempPath);
    // Cleanup best-effort : stream → close, plus signal d'aborde si client déconnecte.
    const cleanup = () => rm(dirname(tempPath), { recursive: true, force: true }).catch(() => {});
    stream.once("close", cleanup);
    const abort = () => {
      try {
        stream.destroy();
      } catch {
        /* déjà fermé */
      }
    };
    if (request.signal.aborted) {
      abort();
    } else {
      request.signal.addEventListener("abort", abort, { once: true });
      stream.once("close", () => request.signal.removeEventListener("abort", abort));
    }
    return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ProfileError) return apiCatch(err, "api.me.export");
    return apiCatch(err, "api.me.export");
  }
}
