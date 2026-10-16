import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { contactMessages, type ContactStatus, type ContactSubject } from "@/db/schema";
import { captureError } from "@/lib/monitoring";
import { adminRecipients, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { checkLimit } from "@/lib/ratelimit";
import {
  contactNotifyHtml,
  contactNotifySubject,
  contactNotifyText,
} from "@/lib/email-templates/contact-notify";

/**
 * Contact plateforme (Phase 3) : formulaire public SANS auth (les
 * sponsors/partenaires ne sont pas forcément membres) → file admin.
 * Anti-abus : honeypot (rejet silencieux), rate-limit IP (3/h) +
 * email (5/j), bornes strictes. Succès = ligne créée + email staff
 * best-effort (jamais bloquant : un Resend en panne ne doit pas faire
 * perdre un lead).
 */

/** Libellés FR — `lib/contact-subjects.ts` (pur, partageable client). */
import { CONTACT_SUBJECTS, contactSubjectLabel } from "@/lib/contact-subjects";
export { CONTACT_SUBJECTS, contactSubjectLabel };

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(80, "Nom trop long."),
  email: z.string().trim().toLowerCase().max(254, "Email trop long.").email("Email invalide."),
  subject: z.enum(["sponsoring", "partenariat", "presse", "support", "autre"]),
  message: z
    .string()
    .trim()
    .min(20, "Message trop court (20 signes).")
    .max(2000, "Message trop long."),
  productUrl: z
    .string()
    .trim()
    .max(500, "Lien trop long.")
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v),
      "Lien invalide (https://…).",
    )
    .optional()
    .default(""),
});

export type SubmitContactInput = {
  name: string;
  email: string;
  /** Motif brut (validé par le schéma : enum fermé). */
  subject: string;
  message: string;
  productUrl?: string;
  /** Honeypot : champ invisible, jamais rempli par un humain. */
  company?: string;
  /** IP best-effort (anti-burst, jamais bloquante si illisible). */
  ip?: string | null;
};

export async function submitContact(
  input: SubmitContactInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Honeypot rempli = bot : succès silencieux (rien créé, rien envoyé,
  // et on ne le dit pas — sinon le bot s'adapte).
  if (input.company != null && input.company.trim() !== "") return { ok: true };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Message invalide." };
  }
  const data = parsed.data;
  if (input.ip) {
    const burst = await checkLimit({
      namespace: "contact:ip",
      id: input.ip,
      window: { window: "1 h", max: 3 },
    });
    if (!burst.allowed)
      return { ok: false, message: "Trop de messages — réessayez dans une heure." };
  }
  const quota = await checkLimit({
    namespace: "contact:email",
    id: data.email,
    window: { window: "1 d", max: 5 },
  });
  if (!quota.allowed) return { ok: false, message: "Trop de messages — réessayez demain." };
  const [row] = await db
    .insert(contactMessages)
    .values({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      productUrl: data.productUrl === "" ? null : data.productUrl,
    })
    .returning({ id: contactMessages.id });
  if (!row) return { ok: false, message: "Envoi impossible pour le moment." };
  // Notif staff best-effort : l'échec email ne fait jamais perdre le lead.
  try {
    const to = adminRecipients();
    if (to.length > 0) {
      const origin = siteUrl();
      await sendEmail({
        to,
        subject: contactNotifySubject(contactSubjectLabel(data.subject), data.name),
        template: "contact-notify",
        html: contactNotifyHtml({
          name: data.name,
          email: data.email,
          subjectLabel: contactSubjectLabel(data.subject),
          message: data.message,
          productUrl: data.productUrl === "" ? null : data.productUrl,
          inboxUrl: `${origin}/admin/contact`,
          origin,
        }),
        text: contactNotifyText({
          name: data.name,
          email: data.email,
          subjectLabel: contactSubjectLabel(data.subject),
          message: data.message,
          productUrl: data.productUrl === "" ? null : data.productUrl,
          inboxUrl: `${origin}/admin/contact`,
          origin,
        }),
      });
    }
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "contact.notify" });
  }
  return { ok: true };
}

export type ContactListItem = {
  id: string;
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  productUrl: string | null;
  status: ContactStatus;
  createdAt: Date;
};

/** File admin : plus récents d'abord, filtre statut optionnel (staff seul). */
export async function listContactMessages(input: {
  isStaff: boolean;
  status?: ContactStatus | "all";
}): Promise<ContactListItem[]> {
  if (!input.isStaff) throw new Error("Réservé à l'équipe.");
  const conditions =
    input.status && input.status !== "all" ? [eq(contactMessages.status, input.status)] : [];
  return db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      subject: contactMessages.subject,
      message: contactMessages.message,
      productUrl: contactMessages.productUrl,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contactMessages.createdAt))
    .limit(100);
}

/** Compteur « à traiter » (pastille nav admin). */
export async function countNewContactMessages(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contactMessages)
    .where(eq(contactMessages.status, "new"));
  return row?.n ?? 0;
}

export async function setContactStatus(input: {
  isStaff: boolean;
  id: string;
  status: ContactStatus;
}): Promise<boolean> {
  if (!input.isStaff) throw new Error("Réservé à l'équipe.");
  try {
    await db
      .update(contactMessages)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(contactMessages.id, input.id));
    return true;
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "contact.status" });
    return false;
  }
}
