import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appeals } from "@/db/schema";
import { users } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { APPEALS_BUCKET, uploadObject, type SupabaseClientLike } from "@/lib/supabase/storage";

/**
 * Domaine appels — le SEUL chemin d'écriture d'un banni (avec la
 * suppression de compte). Tout le reste est verrouillé (assertNotBanned
 * + RLS §3d). Service_role uniquement (policies deny-all via Data API).
 */

export const APPEAL_MAX_FILES = 3;
export const APPEAL_MAX_BYTES = 10 * 1024 * 1024;
// Délai entre deux dépôts (le premier est immédiat). Les appels restent
// ILLIMITÉS en nombre, espacés en fréquence : un appel sérieux avec des
// éléments nouveaux ne se construit pas en une heure.
export const APPEAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const EXPLANATION_MIN = 10;
export const EXPLANATION_MAX = 2000;

type EvidenceKind = "png" | "jpeg" | "webp" | "pdf";

function detectEvidenceKind(buffer: Buffer): EvidenceKind | null {
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
  if (buffer.length > 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return null; // exécutables, SVG, archives : refusés.
}

const KIND_META: Record<EvidenceKind, { ext: string; contentType: string }> = {
  png: { ext: "png", contentType: "image/png" },
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  webp: { ext: "webp", contentType: "image/webp" },
  pdf: { ext: "pdf", contentType: "application/pdf" },
};

export type AppealFile = { buffer: Buffer; size: number };

/**
 * Éligibilité au dépôt (dialog) : même règles que submitAppeal, en
 * lecture seule — le bouton sait AVANT le clic (pas de refus surprise).
 */
export async function getAppealEligibility(
  viewerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [row] = await db
    .select({ id: users.id, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);
  if (!row) return { ok: false, message: "Compte introuvable." };
  if (!row.bannedAt) return { ok: false, message: "Aucune suspension active." };
  const [pending] = await db
    .select({ id: appeals.id })
    .from(appeals)
    .where(and(eq(appeals.userId, row.id), eq(appeals.status, "pending")))
    .limit(1);
  if (pending) {
    return { ok: false, message: "Un appel est déjà en cours d’examen." };
  }
  const [last] = await db
    .select({ createdAt: appeals.createdAt })
    .from(appeals)
    .where(eq(appeals.userId, row.id))
    .orderBy(desc(appeals.createdAt))
    .limit(1);
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < APPEAL_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((APPEAL_COOLDOWN_MS - elapsed) / 3600000);
      return {
        ok: false,
        message: `Prochain appel possible dans ${hoursLeft} h.`,
      };
    }
  }
  return { ok: true };
}
export async function submitAppeal(input: {
  supabase: SupabaseClientLike;
  viewerId: string;
  explanation: string;
  files: AppealFile[];
}): Promise<{ appealId: string; evidencePaths: string[]; seq: number }> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
      appealsCount: users.appealsCount,
    })
    .from(users)
    .where(eq(users.id, input.viewerId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Compte introuvable.");
  if (!row.bannedAt) {
    throw new ProfileError("FORBIDDEN", "Aucune suspension à contester.");
  }

  // Rate limit : appel pending existant → terminer d'abord (pas de file
  // parallèle pour le même compte) ; sinon 24 h entre deux dépôts.
  const [active] = await db
    .select({ id: appeals.id, createdAt: appeals.createdAt })
    .from(appeals)
    .where(eq(appeals.userId, row.id))
    .orderBy(desc(appeals.createdAt))
    .limit(1);
  if (active) {
    const [pending] = await db
      .select({ id: appeals.id })
      .from(appeals)
      .where(and(eq(appeals.userId, row.id), eq(appeals.status, "pending")))
      .limit(1);
    if (pending) {
      throw new ProfileError("FORBIDDEN", "Un appel est déjà en cours d'examen.");
    }
    const elapsed = Date.now() - active.createdAt.getTime();
    if (elapsed < APPEAL_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((APPEAL_COOLDOWN_MS - elapsed) / 3600000);
      throw new ProfileError(
        "FORBIDDEN",
        `Prochain appel possible dans ${hoursLeft} h — rassemblez des éléments nouveaux.`,
      );
    }
  }

  const explanation = input.explanation.trim();
  if (explanation.length < EXPLANATION_MIN) {
    throw new ProfileError("VALIDATION", `Expliquez en au moins ${EXPLANATION_MIN} caractères.`);
  }
  if (explanation.length > EXPLANATION_MAX) {
    throw new ProfileError("VALIDATION", `Explication trop longue (${EXPLANATION_MAX} max).`);
  }
  if (input.files.length > APPEAL_MAX_FILES) {
    throw new ProfileError("VALIDATION", `${APPEAL_MAX_FILES} pièces maximum.`);
  }

  const stamp = Date.now();
  const evidencePaths: string[] = [];
  for (const [i, file] of input.files.entries()) {
    if (file.size > APPEAL_MAX_BYTES) {
      throw new ProfileError("FILE_REJECTED", "Pièce trop lourde (10 Mo max).");
    }
    const kind = detectEvidenceKind(file.buffer);
    if (!kind) {
      throw new ProfileError("FILE_REJECTED", "Preuves acceptées : images PNG/JPG/WebP ou PDF.");
    }
    const path = `${row.id}/${stamp}-${i}.${KIND_META[kind].ext}`;
    const { error } = await uploadObject(
      input.supabase,
      APPEALS_BUCKET,
      path,
      file.buffer,
      KIND_META[kind].contentType,
    );
    if (error) throw new ProfileError("FILE_REJECTED", `Envoi impossible : ${error}`);
    evidencePaths.push(path);
  }

  // Rang figé au dépôt (Appel nºX) : appelsCount + 1, stocké sur la
  // ligne — jamais recalculé, une décision ne renumérote rien. La
  // contrainte unique (user_id, seq) garde-fouille la concurrence
  // (rate limit : un seul dépôt possible à la fois de toute façon).
  const seq = row.appealsCount + 1;
  const [appeal] = await db
    .insert(appeals)
    .values({
      userId: row.id,
      seq,
      banReason: row.banReason ?? "Non précisé",
      explanation,
      evidencePaths,
    })
    .returning({ id: appeals.id });
  await db
    .update(users)
    .set({
      appealsCount: sql`${users.appealsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.id));

  return { appealId: appeal.id, evidencePaths, seq };
}

/** Appels pending + identité (file admin — staff only côté appelant). */
export async function getPendingAppealsCount(): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(appeals)
    .where(eq(appeals.status, "pending"));
  return value;
}

/** Appels pending + identité complète (file admin — staff only côté appelant). */
export async function getPendingAppeals() {
  return db
    .select({
      id: appeals.id,
      userId: appeals.userId,
      seq: appeals.seq,
      banReason: appeals.banReason,
      explanation: appeals.explanation,
      evidencePaths: appeals.evidencePaths,
      createdAt: appeals.createdAt,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      providers: users.providers,
      joinedAt: users.createdAt,
    })
    .from(appeals)
    .innerJoin(users, eq(appeals.userId, users.id))
    .where(eq(appeals.status, "pending"))
    .orderBy(desc(appeals.createdAt));
}

export type PendingAppeal = Awaited<ReturnType<typeof getPendingAppeals>>[number];

/**
 * Tranche un appel : overturned → débanni + statut ; upheld → statut.
 * Retourne l'identité pour la notification décision (best-effort).
 */ export async function reviewAppeal(input: {
  isStaff: boolean;
  appealId: string;
  decision: "upheld" | "overturned";
}): Promise<{ email: string; displayName: string; userId: string; overturned: boolean }> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [appeal] = await db.select().from(appeals).where(eq(appeals.id, input.appealId)).limit(1);
  if (!appeal) throw new ProfileError("NOT_FOUND", "Appel introuvable.");
  if (appeal.status !== "pending") {
    throw new ProfileError("CONFLICT", "Appel déjà tranché.");
  }
  const [user] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, appeal.userId))
    .limit(1);
  if (!user) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  if (input.decision === "overturned") {
    await db
      .update(users)
      .set({ banReason: null, bannedAt: null, updatedAt: new Date() })
      .where(eq(users.id, appeal.userId));
  }
  await db
    .update(appeals)
    .set({ status: input.decision, reviewedAt: new Date() })
    .where(eq(appeals.id, appeal.id));

  return {
    email: user.email,
    displayName: user.displayName,
    userId: appeal.userId,
    overturned: input.decision === "overturned",
  };
}

/**
 * Clôture les appels pending d'un user (déban direct hors appel) :
 * marqués `overturned` SANS email de décision — la notification de déban
 * couvre (pas de double envoi). Retourne le nombre clôturé (toast admin).
 */
export async function closePendingAppealsForUser(userId: string): Promise<number> {
  const closed = await db
    .update(appeals)
    .set({ status: "overturned", reviewedAt: new Date() })
    .where(and(eq(appeals.userId, userId), eq(appeals.status, "pending")))
    .returning({ id: appeals.id });
  return closed.length;
}
