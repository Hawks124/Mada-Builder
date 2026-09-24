"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  ProfileError,
  deleteAccount,
  updateAvatar,
  updateProfile,
} from "@/services/users.service";
import { AVATAR_BUCKET } from "@/lib/supabase/storage";
import { withToast } from "@/lib/toast";
import { captureError } from "@/lib/monitoring";

export type ProfileActionState = { ok: boolean; message: string | null };

const LOGIN_REQUIRED: ProfileActionState = {
  ok: false,
  message: "Connectez-vous pour enregistrer.",
};

function mapProfileError(e: unknown): ProfileActionState {
  if (e instanceof ProfileError) return { ok: false, message: e.message };
  captureError(e, { op: "profile.save" });
  return { ok: false, message: "Enregistrement impossible pour le moment." };
}

function revalidateMaker(username: string): void {
  revalidatePath("/dashboard/profile");
  revalidatePath(`/makers/${username}`);
  revalidatePath("/");
}

/** "Ville, Pays" → { city, country } (champ unique côté UI, §15). */
function splitLocation(raw: FormDataEntryValue | null): {
  city?: string;
  country?: string;
} {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  const [city, ...rest] = raw.split(",");
  const out: { city?: string; country?: string } = {};
  if (city?.trim()) out.city = city.trim();
  const country = rest.join(",").trim();
  if (country) out.country = country;
  return out;
}

const SOCIAL_IDS = [
  "github",
  "x",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "whatsapp",
] as const;

function socialLinksFrom(formData: FormData): Record<string, string> {
  const links: Record<string, string> = {};
  for (const id of SOCIAL_IDS) {
    const v = formData.get(`social:${id}`);
    if (typeof v === "string" && v.trim() !== "") links[id] = v.trim();
  }
  return links;
}

/**
 * Enregistre le profil (nom, bio, occupation, site, localisation, réseaux).
 * Ownership + validation Zod côté service ; jamais role/email/username.
 */
export async function updateMyProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getSessionUser();
  if (!user) return LOGIN_REQUIRED;
  try {
    const { username } = await updateProfile(user.id, user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      occupation: String(formData.get("occupation") ?? ""),
      websiteUrl: String(formData.get("websiteUrl") ?? ""),
      ...splitLocation(formData.get("location")),
      socialLinks: socialLinksFrom(formData),
    });
    revalidateMaker(username);
    return { ok: true, message: "Profil enregistré." };
  } catch (e) {
    return mapProfileError(e);
  }
}

/**
 * Upload avatar (pipeline sharp + storage, service). Retourne l'URL pour
 * la prévisualisation immédiate côté client.
 */
export async function uploadMyAvatar(
  _prev: ProfileActionState & { avatarUrl?: string },
  formData: FormData,
): Promise<ProfileActionState & { avatarUrl?: string }> {
  const user = await getSessionUser();
  if (!user) return LOGIN_REQUIRED;
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choisissez un fichier image." };
  }
  try {
    const supabase = await createClient();
    const { avatarUrl, username } = await updateAvatar(
      supabase,
      user.id,
      user.id,
      file,
    );
    revalidateMaker(username);
    return { ok: true, message: "Avatar mis à jour.", avatarUrl };
  } catch (e) {
    return mapProfileError(e);
  }
}

/**
 * Suppression réelle du compte (§6F) — irréversible.
 * Ordre : auth.users d'abord (coupe l'accès), storage, ligne DB (garde
 * dernier-admin dans le service), signOut, redirect. DangerZone exige déjà
 * la saisie de l'email côté client (friction proportionnée).
 * Atterrissage confirmé par toast (l'irréversible mérite une preuve).
 */
export async function deleteMyAccount(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  // 1. Coupe l'accès auth (service_role) — plus de login possible après.
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (e) {
    captureError(e, { op: "account.deleteAuth" });
    throw new Error("Suppression impossible pour le moment (auth).");
  }

  // 2. Objets storage du préfixe {uid}/ (best-effort, jamais bloquant).
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(AVATAR_BUCKET).list(user.id);
    const paths = (data ?? []).map((f) => `${user.id}/${f.name}`);
    if (paths.length > 0) {
      await admin.storage.from(AVATAR_BUCKET).remove(paths);
    }
  } catch (e) {
    captureError(e, { op: "account.deleteStorage" });
  }

  // 3. Ligne DB (hard delete RGPD ; garde dernier-admin incluse).
  try {
    await deleteAccount(user.id, user.id);
  } catch (e) {
    if (e instanceof ProfileError) throw new Error(e.message);
    captureError(e, { op: "account.deleteRow" });
    throw new Error("Suppression impossible pour le moment.");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(withToast("/", "ok", "Compte supprimé définitivement."));
}

/** Ligne profil complète (édition) — ownership implicite (propre ligne). */
export async function fetchMyProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  const [row] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      occupation: users.occupation,
      websiteUrl: users.websiteUrl,
      socialLinks: users.socialLinks,
      country: users.country,
      city: users.city,
    })
    .from(users)
    .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}
