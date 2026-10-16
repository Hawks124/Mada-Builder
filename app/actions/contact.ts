"use server";

import { requireStaffId } from "@/app/actions/admin";
import { listContactMessages, setContactStatus, submitContact } from "@/services/contact.service";
import type { ContactStatus } from "@/db/schema";
import { captureError } from "@/lib/monitoring";

/** IP best-effort (anti-burst, jamais bloquante si illisible — pattern votes). */
async function clientIp(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const list = await headers();
    const forwarded = list.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || null;
  } catch {
    return null;
  }
}

export type ContactSubmitState = { ok: true } | { ok: false; message: string };

/**
 * Envoi public (SANS auth — sponsors et partenaires ne sont pas
 * forcément membres). Validation + honeypot + rate-limit côté service ;
 * succès = « bien reçu, réponse sous 5 jours ouvrés » (jamais de ticket
 * bidon, jamais l'id interne).
 */
export async function submitContactAction(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  productUrl?: string;
  company?: string;
}): Promise<ContactSubmitState> {
  try {
    return await submitContact({ ...input, ip: await clientIp() });
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "contact.submit" });
    return { ok: false, message: "Envoi impossible pour le moment." };
  }
}

/** Changement de statut (staff seul — gate au layout admin + ici). */
export async function setContactStatusAction(input: {
  id: string;
  status: ContactStatus;
}): Promise<{ ok: boolean }> {
  try {
    await requireStaffId();
    return { ok: await setContactStatus({ isStaff: true, id: input.id, status: input.status }) };
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "contact.staff" });
    return { ok: false };
  }
}

/** File admin (staff seul). */
export async function getContactInboxAction(status?: ContactStatus | "all") {
  try {
    await requireStaffId();
    return await listContactMessages({ isStaff: true, status });
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "contact.inbox" });
    return [];
  }
}
