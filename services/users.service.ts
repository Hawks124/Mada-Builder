import { z } from "zod";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import sharp from "sharp";
import { db } from "@/db";
import { users } from "@/db/schema";
import { OCCUPATIONS } from "@/config/occupations";
import { slugifyName } from "@/lib/utils";
import {
  avatarPath,
  avatarPathFromUrl,
  avatarPublicUrl,
  deleteAvatarObject,
  uploadAvatarObject,
  type SupabaseClientLike,
} from "@/lib/supabase/storage";

/**
 * Domaine users — datasets + règles. Séparation stricte :
 * - ce module ne lit JAMAIS la session (testable, agnostique) ;
 * - l'appelant (Server Action / layout) fournit l'identité vérifiée
 *   (`viewerId`, `isAdmin`) et mappe les erreurs en réponses HTTP.
 * Backend : Drizzle + Supabase (RLS + Storage), voir docs/auth.md.
 */

// ── Erreurs typées ───────────────────────────────────────────────────────────
export class ProfileError extends Error {
  code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "FILE_REJECTED";
  constructor(code: ProfileError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// ── Validation (Zod v4 idiomatique, co-localisée, réutilisable client) ───────
const RESERVED_USERNAMES = [
  "admin",
  "api",
  "settings",
  "dashboard",
  "signin",
  "signup",
  "makers",
  "products",
  "categories",
  "revenue",
  "search",
  "donate",
  "regles",
  "confidentialite",
  "conditions",
  "root",
  "support",
  "help",
  "about",
];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "3 caractères minimum")
  .max(20, "20 caractères maximum")
  .regex(/^[a-z0-9-]+$/, "lettres, chiffres et tirets uniquement")
  .refine((v) => !RESERVED_USERNAMES.includes(v), "Nom réservé")
  .refine((v) => !v.startsWith("-") && !v.endsWith("-"), "Sans tiret aux bords");

const optionalUrlSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.url().optional(),
);

const socialLinksSchema = z
  .object({
    github: optionalUrlSchema,
    x: optionalUrlSchema,
    facebook: optionalUrlSchema,
    instagram: optionalUrlSchema,
    linkedin: optionalUrlSchema,
    tiktok: optionalUrlSchema,
    whatsapp: optionalUrlSchema,
    website: optionalUrlSchema,
  })
  .partial();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(160).optional(),
  occupation: z
    .string()
    .refine((id) => OCCUPATIONS.some((o) => o.id === id), "Occupation inconnue"),
  websiteUrl: optionalUrlSchema,
  city: z.string().trim().max(60).optional(),
  country: z.string().trim().max(60).optional(),
  socialLinks: socialLinksSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// NOTE : ni `role`, ni `email`, ni `username` dans le schéma → un payload
// forgé ne peut pas s'auto-promouvoir (clés inconnues strippées par Zod).
// L'email est immutable V1, le username immuable à vie, le rôle via SQL/admin.

// ── Lecture privée (API v1 : le mobile lit sa propre ligne complète —
// droit d'accès RGPD + écran suspendu : inclut bannedAt/banReason, que
// le web réserve à l'admin partout ailleurs) ──────────────────────────
export async function fetchOwnProfile(userId: string) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      occupation: users.occupation,
      websiteUrl: users.websiteUrl,
      socialLinks: users.socialLinks,
      country: users.country,
      city: users.city,
      providers: users.providers,
      role: users.role,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
      appealsCount: users.appealsCount,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// ── Lecture publique (allowlist stricte — jamais l'email) ────────────────────
// fetch* = pur Drizzle (testable hors Next, scripts/). get* = enveloppe
// Next (cache tags). Les mutations retournent le username pour que
// l'appelant (Server Action) invalide : revalidateTag(`maker:${username}`).
export async function fetchUserProfile(username: string) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      occupation: users.occupation,
      websiteUrl: users.websiteUrl,
      socialLinks: users.socialLinks,
      country: users.country,
      city: users.city,
      // Statut public (badge "Suspendu") — jamais l'email, jamais le motif.
      bannedAt: users.bannedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.username, username.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// Déduplication par requête (stable, sans flag). Le cache persistant
// ("use cache" + tags) viendra avec les lectures réelles au milestone
// listings — pas de flag expérimental dans la fondation.
export const getUserProfile = cache(async (username: string) => {
  return fetchUserProfile(username);
});

// ── Écriture profil (ownership obligatoire) ───────────────────────────────────
/**
 * Garde banni — toute mutation (profil, avatar, link, grade, et demain
 * submit/votes) commence ici. Seules exceptions : suppression de compte
 * (RGPD, inaliénable) et dépôt d'appel. Le RLS §3d double la barrière
 * côté PostgREST direct — mais l'enforcement réel vit ICI.
 */
export async function assertNotBanned(userId: string): Promise<void> {
  const [row] = await db
    .select({ bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row?.bannedAt) {
    throw new ProfileError("FORBIDDEN", "Compte suspendu.");
  }
}

export async function updateProfile(viewerId: string, targetId: string, rawInput: unknown) {
  if (viewerId !== targetId) {
    throw new ProfileError("FORBIDDEN", "Modification du profil d'autrui interdite.");
  }
  await assertNotBanned(viewerId);
  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ProfileError("VALIDATION", "Champs invalides.");
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  const row = existing[0];
  if (!row) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  await db
    .update(users)
    .set({
      displayName: data.displayName,
      bio: data.bio ?? null,
      occupation: data.occupation,
      websiteUrl: data.websiteUrl ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      socialLinks: data.socialLinks ?? {},
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetId));

  // L'appelant (Server Action) invalide : revalidateTag(`maker:${username}`).
  return { ok: true as const, username: row.username };
}

// ── Avatar : pipeline déterministe (validation → sharp → storage) ────────────
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024; // garde anti-bombe de décompression
const AVATAR_MIN_PX = 128;
const AVATAR_OUT_PX = 512;

type ImageKind = "png" | "jpeg" | "webp";

function detectImageKind(buffer: Buffer): ImageKind | null {
  if (
    buffer.length > 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "jpeg";
  if (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null; // SVG/GIF/autres : refusés (XSS, animation)
}

export async function updateAvatar(
  supabase: SupabaseClientLike,
  viewerId: string,
  targetId: string,
  file: File,
): Promise<{ avatarUrl: string; username: string }> {
  if (viewerId !== targetId) {
    throw new ProfileError("FORBIDDEN", "Modification du profil d'autrui interdite.");
  }
  await assertNotBanned(viewerId);
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new ProfileError("FILE_REJECTED", "Fichier trop lourd (10 Mo max avant compression).");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectImageKind(buffer);
  if (!kind) {
    throw new ProfileError(
      "FILE_REJECTED",
      "Format non supporté — PNG, JPG ou WebP uniquement (SVG interdit).",
    );
  }

  const pipeline = sharp(buffer).rotate(); // EXIF auto (photos téléphone)
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < AVATAR_MIN_PX) {
    throw new ProfileError("FILE_REJECTED", "Image trop petite — 128 px minimum.");
  }
  const out = await pipeline
    .resize(AVATAR_OUT_PX, AVATAR_OUT_PX, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  if (out.length > 2 * 1024 * 1024) {
    throw new ProfileError(
      "FILE_REJECTED",
      "Image incompressible — essayez un visuel plus simple.",
    );
  }

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl, username: users.username })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!current) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  const path = avatarPath(targetId);
  const { error } = await uploadAvatarObject(supabase, path, out);
  if (error) throw new ProfileError("FILE_REJECTED", `Upload impossible : ${error}`);

  const url = avatarPublicUrl(supabase, path);
  await db
    .update(users)
    .set({ avatarUrl: url, updatedAt: new Date() })
    .where(eq(users.id, targetId));

  // Ancien fichier supprimé (pas de bloat storage), après succès.
  const oldPath = avatarPathFromUrl(current.avatarUrl);
  if (oldPath && oldPath !== path) {
    await deleteAvatarObject(supabase, oldPath);
  }

  // L'appelant invalide : revalidateTag(`maker:${username}`).
  return { avatarUrl: url, username: current.username };
}

// ── Suppression réelle (§6F) — cascade documentée ─────────────────────────────
export async function deleteAccount(viewerId: string, targetId: string) {
  if (viewerId !== targetId) {
    throw new ProfileError("FORBIDDEN", "Suppression du compte d'autrui interdite.");
  }
  const [row] = await db
    .select({ id: users.id, role: users.role, username: users.username })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  // Garde-fou : jamais le dernier admin (verrouillerait le panel).
  if (row.role === "admin") {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
    if (admins.length <= 1) {
      throw new ProfileError("FORBIDDEN", "Impossible : dernier administrateur.");
    }
  }

  // Ordre de cascade (tables produits/votes/revenus au milestone listings —
  // leurs suppressions s'insèrent ici AVANT la ligne user) :
  //   1. objets storage avatar (préfixe {uid}/) — via service appelant
  //   2. products de l'utilisateur (+ images, screenshots, connexions)
  //   3. votes de l'utilisateur
  //   4. ligne users (hard delete RGPD, pas de soft-delete ici)
  await db.delete(users).where(eq(users.id, targetId));
  return { ok: true as const, username: row.username };
}

// ── Auth : sync providers (multi strict) ──────────────────────────────────────
export async function addAuthProvider(userId: string, provider: "github" | "google" | "email") {
  // Idempotent : append SEULEMENT si absent (chaque login repasse ici —
  // l'ancien array_append aveugle produisait ["google","google"]).
  await db
    .update(users)
    .set({
      providers: sql`array_append(${users.providers}, ${provider})`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), sql`NOT (${users.providers} @> ARRAY[${provider}]::text[])`));
}

/**
 * Rattrapage avatar OAuth : si la ligne n'a pas d'avatar (comptes créés
 * avant le support de la clé `picture` de Google), on remplit depuis les
 * metadata — sans jamais écraser un avatar uploadé (priorité upload).
 */
export async function syncAvatarIfMissing(
  userId: string,
  metadataAvatarUrl: string | null,
): Promise<void> {
  if (!metadataAvatarUrl) return;
  await db
    .update(users)
    .set({ avatarUrl: metadataAvatarUrl, updatedAt: new Date() })
    .where(and(eq(users.id, userId), sql`${users.avatarUrl} IS NULL`));
}

// ── Admin (appelants vérifiés staff AVANT — proxy + layout + actions) ─────────
export type AdminUserStatus = "all" | "banned";

export async function getAdminUsers(input: {
  isStaff: boolean;
  q?: string;
  status?: AdminUserStatus;
  cursor?: { createdAt: Date; id: string } | null;
  limit?: number;
}) {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const q = (input.q ?? "").trim();
  const status = input.status ?? "all";

  const conditions = [isNull(users.deletedAt)];
  if (status === "banned") {
    conditions.push(isNotNull(users.bannedAt));
  }
  if (q !== "") {
    conditions.push(
      or(
        ilike(users.username, `%${q}%`),
        ilike(users.displayName, `%${q}%`),
        ilike(users.email, `%${q}%`),
      )!,
    );
  }
  // Keyset (created_at, id) — O(1) quelle que soit la taille, pas de COUNT.
  if (input.cursor) {
    conditions.push(
      sql`(${users.createdAt}, ${users.id}) < (${input.cursor.createdAt.toISOString()}, ${input.cursor.id})`,
    );
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      providers: users.providers,
      role: users.role,
      banReason: users.banReason,
      bannedAt: users.bannedAt,
      appealsCount: users.appealsCount,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

/**
 * Curseur opaque (URL) ↔ keyset typé. Invalide (tripoté, expiré de sens)
 * → null = repart au début, jamais de crash. Testé (verify script).
 */
export function encodeCursor(cursor: { createdAt: Date; id: string } | null): string | null {
  if (!cursor) return null;
  return Buffer.from(
    JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeCursor(
  raw: string | null | undefined,
): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { c, i } = parsed as { c?: unknown; i?: unknown };
    if (typeof c !== "string" || typeof i !== "string" || i === "") {
      return null;
    }
    const createdAt = new Date(c);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: i };
  } catch {
    return null;
  }
}

export async function banUser(isStaff: boolean, targetId: string, reason: string) {
  if (!isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const clean = reason.trim();
  if (clean === "") throw new ProfileError("VALIDATION", "Motif requis.");
  const [target] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) throw new ProfileError("NOT_FOUND", "Compte introuvable.");
  await db
    .update(users)
    .set({
      banReason: clean,
      bannedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetId));
  // Audit via logAdminAction côté appelant (fail-soft). revalidateTag
  // maker au milestone listings (cache persistant — pas de flag avant).
  // Identité retournée pour la notification victime (best-effort).
  return { ok: true as const, email: target.email, displayName: target.displayName, reason: clean };
}

export async function unbanUser(isStaff: boolean, targetId: string) {
  if (!isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [target] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) throw new ProfileError("NOT_FOUND", "Compte introuvable.");
  await db
    .update(users)
    .set({ banReason: null, bannedAt: null, updatedAt: new Date() })
    .where(eq(users.id, targetId));
  // Audit via logAdminAction côté appelant (fail-soft). revalidateTag
  // maker au milestone listings (cache persistant — pas de flag avant).
  // Identité retournée pour la notification (best-effort, comme banUser).
  return { ok: true as const, email: target.email, displayName: target.displayName };
}

// ── Onboarding /bienvenue (complétion profil post-signup) ────────────────────
// GitHub sans email → trigger placeholder (setup.sql) au lieu d'un crash
// NOT NULL : la gate exige un vrai email ensuite. Marqueur partagé ici
// (même règle des deux côtés — trigger SQL et service).
export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@placeholder.local");
}

export type MissingField = "email" | "displayName";

/**
 * Champs manquants : email placeholder OU nom vide. Ligne absente (lag
 * trigger) → tout manquant (la page crée au submit). null = rien à
 * demander (PAS synonyme de "onboarding fini" — voir ci-dessous).
 */
export async function getMissingProfileFields(userId: string): Promise<MissingField[] | null> {
  const [row] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return ["email", "displayName"];
  const missing: MissingField[] = [];
  if (isPlaceholderEmail(row.email)) missing.push("email");
  if (!row.displayName || row.displayName.trim().length < 2) {
    missing.push("displayName");
  }
  return missing.length > 0 ? missing : null;
}

/**
 * Statut onboarding — L'UNIQUE source de vérité (gate ET page lisent
 * ici, jamais de logique dupliquée : deux prédicats divergents ont
 * produit la boucle /dashboard ↔ /bienvenue, post-mortem docs/auth.md).
 * done = flag posé ET données propres (le flag seul ment pour les lignes
 * créées après la migration ; les champs seuls mentent pour les lignes
 * jamais passées par le formulaire).
 */
export async function getOnboardingStatus(userId: string): Promise<{
  done: boolean;
  missing: MissingField[] | null;
}> {
  const [row] = await db
    .select({
      onboardingCompleted: users.onboardingCompleted,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { done: false, missing: ["email", "displayName"] };
  const missing = await getMissingProfileFields(userId);
  return { done: row.onboardingCompleted && !missing, missing };
}

/**
 * Données du formulaire /bienvenue (pré-remplissage) : nom/occupation
 * provider (éditable — 1 clic si déjà bon), email vidé si placeholder
 * (jamais de garbage pré-rempli : pattern `missing-xxxxxxxx` = champ
 * vide + required). null si ligne absente (la page crée au submit).
 */
export async function getOnboardingFormData(userId: string): Promise<{
  email: string;
  displayName: string;
  occupation: string;
  provider: string;
  username: string;
  avatarUrl: string | null;
  accountId: string;
} | null> {
  const [row] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      occupation: users.occupation,
      providers: users.providers,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const generated = /^missing-[0-9a-f]{8}$/i.test(row.displayName.trim());
  return {
    email: isPlaceholderEmail(row.email) ? "" : row.email,
    displayName: generated ? "" : row.displayName,
    occupation: row.occupation,
    provider: row.providers.find((p) => p === "github" || p === "google") ?? "email",
    username: row.username,
    avatarUrl: row.avatarUrl,
    accountId: userId,
  };
}

const completeProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  email: z.email().max(254).optional(),
  // Occupation : optionnelle mais recommandée (badge public, facettes).
  // Vocabulaire fermé partagé (même refine que updateProfile).
  occupation: z
    .string()
    .refine((id) => OCCUPATIONS.some((o) => o.id === id), "Occupation inconnue")
    .optional(),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

/**
 * Complète nom et/ou email — UNIQUEMENT les colonnes fournies.
 * Email modifiable ssi placeholder actuel (sinon immutabilité V1 :
 * changer d'identité de contact = flow dédié, pas ce formulaire).
 * Email déjà pris (case-insensitive, autre id) → VALIDATION (anti-squat).
 * Ligne absente → création minimale (anti-lag trigger, username dédupliqué).
 */
export async function completeProfile(
  viewerId: string,
  targetId: string,
  rawInput: unknown,
): Promise<{ username: string }> {
  if (viewerId !== targetId) {
    throw new ProfileError("FORBIDDEN", "Modification du profil d'autrui interdite.");
  }
  const parsed = completeProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ProfileError("VALIDATION", "Champs invalides.");
  }
  const { displayName, email: rawEmail, occupation } = parsed.data;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : undefined;
  if (displayName === undefined && email === undefined && occupation === undefined) {
    throw new ProfileError("VALIDATION", "Rien à compléter.");
  }

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!row) {
    // Anti-lag trigger : création minimale (username dédupliqué).
    if (!displayName || !email) {
      throw new ProfileError("VALIDATION", "Nom et email requis pour créer le profil.");
    }
    await assertEmailFree(email, targetId);
    const username = await freshUsername(displayName, email);
    await db.insert(users).values({
      id: targetId,
      username,
      displayName,
      email,
      occupation: occupation ?? "maker",
      providers: ["email"],
      onboardingCompleted: true,
    });
    return { username };
  }

  const patch: {
    displayName?: string;
    email?: string;
    occupation?: string;
    onboardingCompleted?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  if (displayName !== undefined) patch.displayName = displayName;
  if (occupation !== undefined) patch.occupation = occupation;
  if (email !== undefined) {
    if (!isPlaceholderEmail(row.email)) {
      if (email !== row.email.trim().toLowerCase()) {
        throw new ProfileError("FORBIDDEN", "Email de contact immuable.");
      }
      // Même email, casse différente → normaliser silencieusement.
    } else {
      await assertEmailFree(email, targetId);
    }
    patch.email = email;
  }
  // Soumission réussie = onboarding vu : le flag tombe ici (jamais avant).
  patch.onboardingCompleted = true;
  await db.update(users).set(patch).where(eq(users.id, targetId));
  return { username: row.username };
}

/** Email libre (case-insensitive, autre id) — anti-squat / anti-500 unique. */
async function assertEmailFree(email: string, exceptId: string): Promise<void> {
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, sql`${users.id} != ${exceptId}`))
    .limit(1);
  if (taken) {
    throw new ProfileError("VALIDATION", "Cet email est déjà utilisé.");
  }
}

/** Username unique : base + suffixe incrémental (miroir trigger SQL). */
async function freshUsername(displayName: string, email: string): Promise<string> {
  const base = slugifyName(displayName) || slugifyName(email.split("@")[0]) || "maker";
  const clean = base.slice(0, 20).replace(/^-+|-+$/g, "") || "maker";
  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? clean : `${clean}-${suffix}`;
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!exists) return candidate;
  }
  return `${clean}-${Math.floor(Math.random() * 1_000_000)}`;
}

// ── Rôles (matrice docs/auth.md §2 : admin fondateur, modérateur
// opérationnel, user). La voie SQL reste possible pour le grade admin.
export type StaffRole = "admin" | "moderateur";

export async function setUserRole(
  actorId: string,
  targetId: string,
  role: "admin" | "moderateur" | "user",
): Promise<{ email: string; displayName: string; role: "admin" | "moderateur" | "user" }> {
  const [actor] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  // Acteur : admin ou modérateur (les appelants panel sont déjà filtrés
  // par requireStaff — double barrière, jamais de confiance au seul UI).
  if (!actor || (actor.role !== "admin" && actor.role !== "moderateur")) {
    throw new ProfileError("FORBIDDEN", "Réservé admin.");
  }
  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) throw new ProfileError("NOT_FOUND", "Compte introuvable.");
  // Strings élargis AVANT le return précoce : le narrowing TS perd la
  // corrélation (target, role) sinon et interdit la comparaison "admin".
  const currentRole = target.role as string;
  const nextRole = role as string;
  if (target.role === role) {
    return { email: target.email, displayName: target.displayName, role };
  }
  // Grade admin inaltérable via UI (les deux sens, SQL founder only).
  if (currentRole === "admin" || nextRole === "admin") {
    throw new ProfileError("FORBIDDEN", "Grade administrateur : SQL uniquement.");
  }
  // Gestion des grades = admin seul (un modérateur ne nomme personne).
  if (actor.role !== "admin") {
    throw new ProfileError("FORBIDDEN", "Gestion des grades : admin uniquement.");
  }
  // Promouvoir un banni n'a aucun sens : débannir d'abord (ordre explicite).
  if (role === "moderateur" && target.bannedAt) {
    throw new ProfileError("FORBIDDEN", "Débannissez d'abord ce compte.");
  }
  if (targetId === actorId) {
    throw new ProfileError("FORBIDDEN", "Vous ne pouvez pas toucher à votre grade.");
  }
  // Garde dernier-admin (même verrou que deleteAccount : panel vivant).
  // Inatteignable via UI (grade admin intouchable) — ceinture, pas bretelles.
  if (target.role === "admin" && role !== "admin") {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
    if (admins.length <= 1 && admins[0]?.id === targetId) {
      throw new ProfileError("FORBIDDEN", "Impossible : dernier administrateur.");
    }
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, targetId));
  return { email: target.email, displayName: target.displayName, role };
}

// ── Vitrine publique (hero) ────────────────────────────────────────────────────
// Derniers inscrits + total — Drizzle pur, testable hors Next.
// Fallback mock côté appelant si backend absent (env-gating, cf. middleware).
// avatarUrl NULL = initiales côté UI (JAMAIS de visage d'emprunt : coller
// un pravatar à un vrai user est une fausse identité — bug QA).
export async function getRecentMakers(limit = 5) {
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.bannedAt)))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit);
  return rows;
}

export async function getMakersCount(): Promise<number> {
  // COUNT côté base — jamais de full scan matérialisé en JS.
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.bannedAt)));
  return value;
}

// ── Helpers slug (règle partagée trigger SQL — voir db/setup.sql) ─────────────
export function buildUsernameCandidate(displayName: string, email: string): string {
  const base = slugifyName(displayName) || slugifyName(email.split("@")[0]) || "maker";
  return base.slice(0, 20).replace(/^-+|-+$/g, "") || "maker";
}
