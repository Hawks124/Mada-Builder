import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  iso,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import { deleteAccount, fetchOwnProfile, updateProfile } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/supabase/storage";
import { captureError } from "@/lib/monitoring";

export const OPTIONS = async () => corsPreflight();

// 405 JSON (jamais de HTML Next) — le contrat, c'est GET/PATCH/DELETE.
export const POST = async () => methodNotAllowed(["GET", "PATCH", "DELETE"]);
export const PUT = async () => methodNotAllowed(["GET", "PATCH", "DELETE"]);

type OwnRow = NonNullable<Awaited<ReturnType<typeof fetchOwnProfile>>>;

/** Miroir exact des données profil privé (dashboard) — dates ISO. */
function serialize(row: OwnRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    occupation: row.occupation,
    websiteUrl: row.websiteUrl,
    socialLinks: row.socialLinks,
    country: row.country,
    city: row.city,
    timeZone: row.timeZone,
    providers: row.providers,
    role: row.role,
    bannedAt: iso(row.bannedAt),
    banReason: row.banReason,
    appealsCount: row.appealsCount,
    onboardingCompleted: row.onboardingCompleted,
    createdAt: iso(row.createdAt),
  };
}

/**
 * Profil privé complet — lecture autorisée même banni (droit d'accès
 * RGPD + écran suspendu : bannedAt/banReason inclus, réservés à soi).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:read", user.id, API_WINDOWS.read);
    const row = await fetchOwnProfile(user.id);
    if (!row) throw new ApiError("UNAUTHORIZED", 401, "Compte introuvable.");
    return apiOk(serialize(row));
  } catch (e) {
    return apiCatch(e, "api.me.get");
  }
}

/**
 * Édition profil — mêmes règles que le formulaire web (schéma Zod
 * whitelist : username/email/role inchangeables, même forgés ;
 * banni refusé ici ET dans le service — double barrière).
 * Réponse = profil frais (pas de refetch côté mobile).
 */
export async function PATCH(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req);
    await apiLimit("api:me:write", user.id, API_WINDOWS.write);
    const body = await readJson(req);
    await updateProfile(user.id, user.id, body);
    const row = await fetchOwnProfile(user.id);
    if (!row) throw new ApiError("NOT_FOUND", 404, "Compte introuvable.");
    return apiOk(serialize(row));
  } catch (e) {
    return apiCatch(e, "api.me.patch");
  }
}

/**
 * Suppression réelle RGPD — mêmes 3 temps que le web (auth → storage
 * best-effort → ligne, garde dernier-admin). Autorisée même bannie
 * (droit inaliénable). `{"confirm":true}` explicite exigé (friction
 * API équivalente à la saisie du username côté web). Le client purge
 * ses tokens après ce 200 (session coupée côté serveur au temps 1).
 */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:me:delete", user.id, { window: "60 s", max: 5 });
    const body = await readJson(req);
    if (body.confirm !== true) {
      throw new ApiError("VALIDATION", 422, "Confirmation requise (confirm: true).");
    }
    const admin = createAdminClient();
    try {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "api.me.deleteAuth",
      });
      throw new ApiError("INTERNAL", 500, "Suppression impossible pour le moment (auth).");
    }
    try {
      const { data } = await admin.storage.from(AVATAR_BUCKET).list(user.id);
      const paths = (data ?? []).map((f) => `${user.id}/${f.name}`);
      if (paths.length > 0) {
        await admin.storage.from(AVATAR_BUCKET).remove(paths);
      }
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "api.me.deleteStorage",
      });
    }
    await deleteAccount(user.id, user.id);
    return apiOk({ deleted: true });
  } catch (e) {
    return apiCatch(e, "api.me.delete");
  }
}
