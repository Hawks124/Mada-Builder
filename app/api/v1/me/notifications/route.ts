import {
  apiCatch,
  apiOk,
  CACHE_PRIVATE,
  corsPreflight,
  methodNotAllowed,
  readJson,
  withCache,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/lib/api/pagination";
import { getNotifications, markNotificationsRead } from "@/services/notifications.service";

export const OPTIONS = async () => corsPreflight();
export const PUT = async () => methodNotAllowed(["GET", "PATCH"]);
export const DELETE = async () => methodNotAllowed(["GET", "PATCH"]);

/**
 * Notifications mobiles (lot notifs) : liste keyset + compteur non-lu
 * (GET, privé no-store) ; tout-lu ou par ids (PATCH). Même service que
 * la cloche web — jamais de divergence.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:notifs:read", user.id, API_WINDOWS.read);
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number.parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 50);
    const data = await getNotifications(user.id, {
      limit,
      cursor: decodeKeysetCursor(sp.get("cursor")),
      unreadOnly: sp.get("unread") === "1",
    });
    return withCache(
      apiOk({
        items: data.items,
        nextCursor: data.nextCursor ? encodeKeysetCursor(data.nextCursor) : null,
        unreadCount: data.unreadCount,
      }),
      CACHE_PRIVATE,
    );
  } catch (e) {
    return apiCatch(e, "api.notifs.get");
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:notifs:write", user.id, API_WINDOWS.write);
    const body = await readJson(req);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100)
      : undefined;
    const data = await markNotificationsRead(user.id, ids);
    return withCache(apiOk(data), CACHE_PRIVATE);
  } catch (e) {
    return apiCatch(e, "api.notifs.patch");
  }
}
