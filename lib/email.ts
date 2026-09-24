import { Resend } from "resend";
import { captureError } from "@/lib/monitoring";

/**
 * Façade email (Resend) — premier usage réel : OTP custom d'auth.
 * Serveur uniquement. Erreurs provider : loggées (Sentry, sans PII) puis
 * converties en erreur générique — jamais de détail Resend au client.
 *
 * Mode test Resend (domaine non vérifié) : envoi restreint à l'adresse du
 * compte + expéditeur onboarding@resend.dev. Voir docs/auth.md (QA).
 */
let cached: Resend | null = null;

function client(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "Resend non configuré — RESEND_API_KEY manquante (voir .env.example).",
    );
  }
  cached = new Resend(key);
  return cached;
}

export function emailFrom(): string {
  return process.env.RESEND_FROM ?? "onboarding@resend.dev";
}

/**
 * Destinataires admin (ADMIN_EMAILS, virgules) — parse, trim, déduplique,
 * filtre les vides. Liste à un élément = adresse seule, valide.
 * Testé (verify script) — jamais de throw ici (le vide se gère à l'appel).
 */
export function adminRecipients(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const email = part.trim().toLowerCase();
    if (email !== "" && !seen.has(email)) seen.add(email);
  }
  return [...seen];
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { data, error } = await client().emails.send({
    from: emailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    // Nom + message Resend uniquement — jamais le destinataire (§16).
    captureError(new Error(`Resend: ${error.name} — ${error.message}`), {
      op: "email.send",
    });
    throw new Error("Envoi de l'email impossible pour le moment.");
  }
  if (!data?.id) {
    captureError(new Error("Resend: réponse sans id"), { op: "email.send" });
    throw new Error("Envoi de l'email impossible pour le moment.");
  }
}
