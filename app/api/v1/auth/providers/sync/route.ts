import { ApiError, apiCatch, apiOk, corsPreflight, methodNotAllowed } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { addAuthProvider, syncAvatarIfMissing } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — sync uniquement.
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);

const KNOWN = ["github", "google", "email"] as const;
type Known = (typeof KNOWN)[number];

/**
 * Sync providers post-login OAuth natif — le chaînon que le natif seul
 * ne couvre pas : le trigger ne pose que le PREMIER provider, et un 2ᵉ
 * provider lié côté mobile sans cet appel laisserait `providers[]`
 * périmé (source de vérité partagée web/mobile).
 *
 * Idempotent et auto-limitée : ne touche QUE soi (id du token, jamais
 * du body — pas d'IDOR par construction), ne connaît que le trio
 * github/google/email (le reste est ignoré, jamais persisté), ne
 * remplit l'avatar que s'il est NULL (jamais d'écrasement d'upload).
 * À appeler après chaque login OAuth et après chaque liaison
 * (supabase_flutter `linkIdentity`), best-effort côté client.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:auth:sync", user.id, API_WINDOWS.authSync);
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !data.user) {
      throw new ApiError("INTERNAL", 500, "Synchronisation impossible pour le moment.");
    }
    const seen = new Set<Known>();
    let avatar: string | null = null;
    for (const identity of data.user.identities ?? []) {
      const p = (identity.provider ?? "").toLowerCase();
      if ((KNOWN as readonly string[]).includes(p)) seen.add(p as Known);
      const meta = (identity.identity_data ?? {}) as Record<string, unknown>;
      if (!avatar) {
        const cand = meta.avatar_url ?? meta.picture;
        if (typeof cand === "string" && cand !== "") avatar = cand;
      }
    }
    for (const p of seen) {
      await addAuthProvider(user.id, p);
    }
    await syncAvatarIfMissing(user.id, avatar);
    return apiOk({ providers: [...seen] });
  } catch (e) {
    return apiCatch(e, "api.auth.sync");
  }
}
