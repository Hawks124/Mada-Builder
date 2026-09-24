import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { authOtp } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/monitoring";
import { checkLimit } from "@/lib/ratelimit";

// Paramètres sécu OTP (documentés docs/auth.md — les changer = mettre à
// jour le template email + le cooldown client du signin-form).
export const OTP_LENGTH = 6;
export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** Fenêtre throttle demande de code — vit ici ET NULLE PART ailleurs. */
export const OTP_REQUEST_WINDOW = { window: "60 s", max: 1 } as const;

const emailSchema = z.email().max(254);

/** Normalisation : trim + lowercase (comparaisons exactes en DB). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** SHA-256 hex — le code en clair n'est JAMAIS persisté ni loggé. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function attemptsExhausted(attempts: number): boolean {
  return attempts >= OTP_MAX_ATTEMPTS;
}

/**
 * Erreur OTP — message public TOUJOURS générique (anti-énumération et
 * anti-oracle : incorrect / expiré / épuisé sont indistinguables).
 * `reason` interne pour les logs (jamais de PII, §16).
 */
export class OtpError extends Error {
  readonly reason: "invalid" | "expired" | "exhausted" | "throttled" | "unavailable";
  constructor(reason: OtpError["reason"]) {
    super("Code incorrect ou expiré.");
    this.reason = reason;
  }
}

/** Génération 6 chiffres — exportée pour les tests, usage interne sinon. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Résout un action_link + hash pour `email` SANS créer de compte :
 * magiclink si le compte existe, sinon null (l'appelant décide —
 * création paresseuse au verify, jamais à la demande).
 */
async function resolveLink(
  email: string,
  redirectTo: string,
): Promise<{ actionLink: string; tokenHash: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error) return null;
  const { action_link: actionLink, hashed_token: tokenHash } = data.properties ?? {};
  if (!actionLink || !tokenHash) return null;
  return { actionLink, tokenHash };
}

/**
 * Double repli au verify : magiclink → createUser → magiclink(retry).
 * Couvre la race "compte créé entre demande et validation" dans les deux
 * sens. Création SANS mot de passe (email_confirm: true : compte confirmé,
 * magiclink/OAuth uniquement) + display_name (préfixe email — le trigger
 * et le dashboard héritent d'un nom décent au lieu de "-"). Le trigger
 * crée la ligne users. Jamais d'avatar ici : les initiales SONT le design
 * (navbar, hero, maker — aucun visage d'emprunt, voir hero-makers).
 */
async function generateLink(
  email: string,
  redirectTo: string,
): Promise<{ actionLink: string; tokenHash: string }> {
  const direct = await resolveLink(email, redirectTo);
  if (direct) return direct;
  const admin = createAdminClient();
  const displayName = email.split("@")[0] || "maker";
  try {
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) throw error;
  } catch (e) {
    // Existe déjà (race : quelqu'un a créé entre-temps) → retry magiclink.
    // Vrai échec → erreur générique dehors (jamais de détail).
    const retry = await resolveLink(email, redirectTo);
    if (retry) return retry;
    captureError(e, { op: "otp.createUser" });
    throw new OtpError("unavailable");
  }
  const retry = await resolveLink(email, redirectTo);
  if (!retry) {
    captureError(new Error("magiclink post-create sans lien"), {
      op: "otp.generateLink",
    });
    throw new OtpError("unavailable");
  }
  return retry;
}

/**
 * Demande un code : throttle Upstash 60 s/email (façade partagée
 * lib/ratelimit), un seul code actif (supprime les précédents), insert
 * puis retourne le code EN CLAIR + l'action_link éventuel à l'appelant
 * (transport email uniquement — jamais persistés, jamais loggés).
 * CRÉATION PARESSEUSE : email inconnu → AUCUN compte créé, AUCUNE ligne
 * users, actionLink null (le lien naît au verify après validation).
 * Throttle → OtpError "throttled" (l'action répondra OK silencieux).
 */
export async function requestEmailCode(input: { email: string; redirectTo: string }): Promise<{
  code: string;
  expiresAt: Date;
  actionLink: string | null;
  tokenHash: string | null;
}> {
  const parsed = emailSchema.safeParse(normalizeEmail(input.email));
  if (!parsed.success) throw new OtpError("invalid");
  const email = parsed.data;

  const { allowed } = await checkLimit({
    namespace: "otp:request",
    id: email,
    window: { ...OTP_REQUEST_WINDOW },
  });
  if (!allowed) throw new OtpError("throttled");

  // Un seul code actif : les précédents deviennent invalides d'un coup.
  await db.delete(authOtp).where(eq(authOtp.email, email));

  const code = generateCode();
  // Email connu → lien + hash immédiats (fallback lien du template).
  // Inconnu → nulls : compte + lien naîtront au verify (paresseux).
  let actionLink: string | null = null;
  let tokenHash: string | null = null;
  try {
    const resolved = await resolveLink(email, input.redirectTo);
    actionLink = resolved?.actionLink ?? null;
    tokenHash = resolved?.tokenHash ?? null;
  } catch (e) {
    captureError(e, { op: "otp.resolveLink" });
    // Panne Supabase : on continue SANS lien (le code reste vérifiable,
    // le lien naîtra au verify). Jamais de refus pour un incident externe.
  }

  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
  await db.insert(authOtp).values({
    email,
    codeHash: hashCode(code),
    actionLink,
    tokenHash,
    expiresAt,
  });
  return { code, expiresAt, actionLink, tokenHash };
}

/** Supprime la ligne OTP d'un email (échec d'envoi → retry immédiat propre). */
export async function discardEmailCode(email: string): Promise<void> {
  await db.delete(authOtp).where(eq(authOtp.email, normalizeEmail(email)));
}

/** Comparaison timing-safe — exportée pour les tests, usage interne sinon. */
export function codesMatch(candidateHash: string, storedHash: string): boolean {
  const a = Buffer.from(candidateHash, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vérifie un code : expiry, burn à 5 tentatives, delete-on-use au succès.
 * Retourne un HASH FRAIS single-flight (généré ici, jamais exposé avant)
 * pour échange server-side — jamais le lien stocké (potentiellement
 * consommé entre-temps : clic mail + saisie code = deux destins, bug QA).
 * Le stocké reste le fallback cliquable du mail, indépendant.
 * CRÉATION PARESSEUSE : si la ligne n'a pas de compte (email inconnu à la
 * demande), il naît ICI, après validation — jamais avant. `redirectTo`
 * requis (même origine que la demande).
 */
export async function verifyEmailCode(input: {
  email: string;
  code: string;
  redirectTo: string;
}): Promise<{ tokenHash: string }> {
  const email = normalizeEmail(input.email);
  const [row] = await db
    .select()
    .from(authOtp)
    .where(and(eq(authOtp.email, email), isNull(authOtp.usedAt)))
    .orderBy(desc(authOtp.createdAt))
    .limit(1);
  if (!row) throw new OtpError("invalid");

  if (isExpired(row.expiresAt)) {
    await db.delete(authOtp).where(eq(authOtp.id, row.id));
    throw new OtpError("expired");
  }
  if (attemptsExhausted(row.attempts)) {
    await db.delete(authOtp).where(eq(authOtp.id, row.id));
    throw new OtpError("exhausted");
  }
  if (!codesMatch(hashCode(input.code.trim()), row.codeHash)) {
    const attempts = row.attempts + 1;
    if (attemptsExhausted(attempts)) {
      await db.delete(authOtp).where(eq(authOtp.id, row.id));
      throw new OtpError("exhausted");
    }
    await db.update(authOtp).set({ attempts }).where(eq(authOtp.id, row.id));
    throw new OtpError("invalid");
  }

  await db.delete(authOtp).where(eq(authOtp.id, row.id));
  // LIEN FRAIS systématique (jamais le stocké) : les liens Supabase sont
  // single-use et le stocké a pu être consommé entre-temps (clic du lien
  // mail + saisie du code, double-clic, prefetch client mail) — d'où des
  // ?error=no_code "aléatoires" en QA. Le stocké reste le fallback
  // cliquable du mail ; le frais, single-flight, sert la validation code.
  // Les deux gestes ne partagent plus de destin. Seul le HASH sort
  // (échange server-side — voir lib/supabase/exchange.ts).
  const { tokenHash } = await generateLink(email, input.redirectTo);
  return { tokenHash };
}

/** Cleanup expirés (cron V1.5 — exposé pour tests et scripts). */
export async function cleanupExpiredOtps(now = new Date()): Promise<number> {
  const deleted = await db
    .delete(authOtp)
    .where(lt(authOtp.expiresAt, now))
    .returning({ id: authOtp.id });
  return deleted.length;
}
