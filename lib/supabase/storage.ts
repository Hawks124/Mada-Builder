import type { SupabaseClient } from "@supabase/supabase-js";

/** Sous-ensemble utilisé (storage uniquement) — mockable en tests. */
export type SupabaseClientLike = Pick<SupabaseClient, "storage">;

/** Bucket unique des avatars — public read, write own-path (policies SQL). */
export const AVATAR_BUCKET = "avatars";

/** Chemin déterministe : avatars/{uid}/avatar-{ts}.webp (jamais le nom client). */
export function avatarPath(userId: string): string {
  return `${userId}/avatar-${Date.now()}.webp`;
}

export async function uploadAvatarObject(
  supabase: SupabaseClientLike,
  path: string,
  buffer: Buffer,
): Promise<{ error?: string }> {
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
  return error ? { error: error.message } : {};
}

/** Bucket des preuves d'appel — PRIVÉ (jamais de public URL dessus). */
export const APPEALS_BUCKET = "appeals";

/** Upload générique (preuves) — contentType explicite, jamais d'upsert. */
export async function uploadObject(
  supabase: SupabaseClientLike,
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false });
  return error ? { error: error.message } : {};
}

export async function deleteAvatarObject(
  supabase: SupabaseClientLike,
  path: string,
): Promise<void> {
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

export function avatarPublicUrl(
  supabase: SupabaseClientLike,
  path: string,
): string {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Extrait le path storage depuis une public URL (pour suppression ancien). */
export function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split("?")[0] || null;
}
