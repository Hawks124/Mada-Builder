import { ApiError, apiCatch } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { apiLimit } from "@/lib/api/ratelimit";
import { ProfileError } from "@/services/users.service";
import { buildUserExport } from "@/services/export.service";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";

/**
 * Export RGPD mobile/v1 : ZIP complet en tmpfile, streamed avec
 * Content-Length exact — jamais une archive partielle côté client.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:export", user.id, { window: "60 m", max: 3 });
    const { filename, tempPath, size } = await buildUserExport(user.id);
    const stream = createReadStream(tempPath);
    const cleanup = () => rm(dirname(tempPath), { recursive: true, force: true }).catch(() => {});
    const nodeStream = stream as unknown as { on: (event: string, fn: () => void) => void };
    nodeStream.on?.("end", cleanup);
    nodeStream.on?.("close", cleanup);
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
    if (err instanceof ProfileError || err instanceof ApiError) {
      return apiCatch(err, "api.v1.me.export");
    }
    return apiCatch(err, "api.v1.me.export");
  }
}
