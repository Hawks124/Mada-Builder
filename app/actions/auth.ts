"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { addAuthProvider, assertNotBanned } from "@/services/users.service";
import {
  OTP_TTL_MIN,
  OtpError,
  discardEmailCode,
  normalizeEmail,
  requestEmailCode,
  verifyEmailCode,
} from "@/services/otp.service";
import { sendEmail } from "@/lib/email";
import { otpEmailHtml, otpEmailSubject, otpEmailText } from "@/lib/email-templates/otp-email";
import { withToast } from "@/lib/toast";
import { exchangeHashForSession } from "@/lib/supabase/exchange";
import { captureError } from "@/lib/monitoring";

type LinkableProvider = "github" | "google";

/**
 * Log serveur dev-only : en prod, Sentry prend le relais (captureError)
 * et ce log est muet. Sans ça, les erreurs Supabase sont invisibles en
 * dev (façade prod-gatée) et les échecs restent "impossible, réessayez".
 * Emails masqués (regex, §16) — jamais de PII même au terminal.
 */
function logAuthErrorDev(op: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const err = error instanceof Error ? error : new Error(String(error));
  const code =
    typeof (err as unknown as { code?: unknown }).code === "string"
      ? (err as unknown as { code: string }).code
      : "";
  const scrubbed = `${err.name} | ${code} | ${err.message}`.replace(
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    "[email]",
  );
  console.error(`[auth:${op}] ${scrubbed}`);
}

/** Origine publique (email links absolus) — partagée avec admin.ts. */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Déconnexion — retour accueil public + toast (canal partagé). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(withToast("/", "info", "Vous êtes déconnecté·e."));
}

/**
 * Lier un 2e provider (session authentifiée = sûr).
 * Redirige vers le provider ; le callback resynchronise providers[].
 * Échec → toast d'erreur sur /settings (canal partagé, jamais silencieux).
 */
export async function linkProvider(provider: LinkableProvider): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  try {
    await assertNotBanned(user.id);
  } catch {
    redirect(withToast("/settings", "err", "Compte suspendu."));
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${await appOrigin()}/auth/callback?next=/settings` },
  });
  if (error || !data.url) {
    const cause = error ?? new Error("linkIdentity sans url");
    captureError(cause, { op: "auth.link", provider });
    logAuthErrorDev("link", cause);
    redirect(withToast("/settings", "err", linkErrorMessage(error?.message ?? "")));
  }
  redirect(data.url);
}

/**
 * Message FR pour un échec de liaison — volontairement générique côté
 * user (le détail Supabase vit dans le terminal dev via logAuthErrorDev :
 * un end-user ne doit jamais lire de doc contributeur). Cas "identité
 * déjà liée ailleurs" : guider, pas merger (dangereux).
 */
function linkErrorMessage(raw: string): string {
  const normalized = raw.toLowerCase();
  if (
    normalized.includes("already") ||
    normalized.includes("linked") ||
    normalized.includes("exists")
  ) {
    return "Ce compte est déjà lié à un autre utilisateur. Déliez-le là-bas d'abord.";
  }
  return "Liaison impossible pour le moment. Réessayez.";
}

/**
 * Délier un provider — REFUSÉ si dernier restant (anti-lockout).
 * Multi strict : on ne laisse jamais un compte sans accès.
 * Feedback via toasts (canal partagé).
 */
export async function unlinkProvider(provider: LinkableProvider): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  try {
    await assertNotBanned(user.id);
  } catch {
    redirect(withToast("/settings", "err", "Compte suspendu."));
  }

  const { data: identities } = await supabase.auth.getUserIdentities();
  const list = identities?.identities ?? [];
  if (list.length <= 1) {
    redirect(
      withToast(
        "/settings",
        "err",
        "Dernier accès : liez un autre fournisseur avant de retirer celui-ci.",
      ),
    );
  }
  const target = list.find((i) => i.provider === provider);
  if (!target) {
    redirect("/settings");
  }
  const { error } = await supabase.auth.unlinkIdentity(target);
  if (error) {
    captureError(error, { op: "auth.unlink", provider });
    logAuthErrorDev("unlink", error);
    redirect(withToast("/settings", "err", "Retrait impossible. Réessayez."));
  }
  // Miroir providers[] resynchronisé au prochain login ; revalidation immédiate.
  revalidatePath("/settings");
  try {
    const [row] = await db
      .select({ providers: users.providers })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (row) {
      await db
        .update(users)
        .set({
          providers: row.providers.filter((p) => p !== provider),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
  } catch {
    // Non bloquant — resync au prochain login.
  }
  redirect(withToast("/settings", "ok", "Fournisseur retiré."));
}

/**
 * Resync manuelle providers[] depuis les identités (appelée au callback ;
 * exposée pour tests et réparation).
 */
export async function syncMyProviders(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const { data: identities } = await supabase.auth.getUserIdentities();
  for (const identity of identities?.identities ?? []) {
    const p = identity.provider;
    if (p === "github" || p === "google" || p === "email") {
      try {
        await addAuthProvider(user.id, p);
      } catch {
        /* miroir best-effort */
      }
    }
  }
  revalidatePath("/settings");
}

/** ?next= validé same-origin (anti open-redirect) — même règle que callback. */
function sanitizeNext(raw: string | null | undefined): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

const emailInputSchema = z.object({
  email: z.email().max(254),
  next: z.string().max(512),
});

type OtpRequestResult = { ok: true } | { ok: false; error: string };

/**
 * Envoie un code OTP 6 chiffres via Resend (template custom FR).
 * Anti-énumération : throttle et email inconnu répondent OK silencieux.
 */
export async function requestEmailCodeAction(input: {
  email: string;
  next: string;
}): Promise<OtpRequestResult> {
  const parsed = emailInputSchema.safeParse({
    email: normalizeEmail(input.email),
    next: input.next,
  });
  if (!parsed.success) {
    return { ok: false, error: "Adresse email invalide." };
  }
  const email = parsed.data.email;
  const origin = await appOrigin();
  const safeNext = sanitizeNext(parsed.data.next);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  let code: string;
  let tokenHash: string | null;
  try {
    const issued = await requestEmailCode({ email, redirectTo });
    code = issued.code;
    tokenHash = issued.tokenHash;
  } catch (e) {
    if (e instanceof OtpError && e.reason === "throttled") {
      // Code précédent encore valide dans la boîte du user — OK silencieux.
      return { ok: true };
    }
    if (!(e instanceof OtpError)) captureError(e, { op: "otp.request" });
    return { ok: false, error: "Envoi impossible pour le moment. Réessayez." };
  }

  // Lien de secours = NOTRE route /auth/exchange (TTL 10 min appliqué
  // côté serveur, jamais de navigation navigateur vers Supabase).
  // Email inconnu (pas de hash) : code seul, le lien naîtra au verify.
  const fallbackLink = tokenHash
    ? `${origin}/auth/exchange?h=${encodeURIComponent(tokenHash)}&next=${encodeURIComponent(safeNext)}`
    : null;
  try {
    await sendEmail({
      to: email,
      subject: otpEmailSubject(),
      html: otpEmailHtml({
        code,
        validityMinutes: OTP_TTL_MIN,
        actionLink: fallbackLink,
        origin,
      }),
      text: otpEmailText({
        code,
        validityMinutes: OTP_TTL_MIN,
        actionLink: fallbackLink,
        origin,
      }),
    });
    return { ok: true };
  } catch (e) {
    // Échec transport : ligne supprimée → retry immédiat propre, pas
    // d'orphelin, pas d'attente du throttle 60 s.
    await discardEmailCode(email);
    captureError(e, { op: "otp.send" });
    return { ok: false, error: "Envoi impossible pour le moment. Réessayez." };
  }
}

type OtpVerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Vérifie le code PUIS échange le hash server-side (cookies posées sur
 * la réponse de l'action). Le client n'a plus qu'à naviguer — jamais de
 * trip navigateur vers Supabase (fini les ?error=no_code opaques).
 * Erreur TOUJOURS générique côté client (anti-oracle).
 */
export async function verifyEmailCodeAction(input: {
  email: string;
  code: string;
  next: string;
}): Promise<OtpVerifyResult> {
  const email = normalizeEmail(input.email);
  if (!z.email().max(254).safeParse(email).success) {
    return { ok: false, error: "Code incorrect ou expiré." };
  }
  // Même redirectTo que la demande (création paresseuse : le lien naît
  // ici si l'email était inconnu — même origine, même règle sanitize).
  const redirectTo = `${await appOrigin()}/auth/callback?next=${encodeURIComponent(sanitizeNext(input.next))}`;
  try {
    const { tokenHash } = await verifyEmailCode({
      email,
      code: input.code,
      redirectTo,
    });
    const exchanged = await exchangeHashForSession(tokenHash);
    if (!exchanged.ok) {
      return { ok: false, error: "Code incorrect ou expiré." };
    }
    return { ok: true };
  } catch (e) {
    if (!(e instanceof OtpError)) captureError(e, { op: "otp.verify" });
    return { ok: false, error: "Code incorrect ou expiré." };
  }
}
