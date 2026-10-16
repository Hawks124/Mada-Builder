import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { users } from "@/db/schema";
import { captureError } from "@/lib/monitoring";

/**
 * Newsletter Phase 2 : digest hebdo = Resend direct per-user (service
 * `notifications`), annonces one-shot = Broadcasts sur une Audience
 * Resend synchronisée depuis `users` (zéro table d'abonnés — l'opt-out
 * local `digest_opt_out` reste la seule source de vérité).
 *
 * Invariants :
 * - seuls les inscrits non-opt-out, ni supprimés ni bannis, à email réel
 *   entrent dans l'audience (même éligibilité que le digest) ;
 * - ajouts manuels dashboard conservés (on ne supprime que les emails
 *   connus devenus inéligibles) ;
 * - désinscription Resend (lien du mail) → `digest_opt_out` local via
 *   webhook `contact.updated` (pas de divergence durable).
 */

export function newsletterAudienceId(): string {
  return (process.env.RESEND_AUDIENCE_ID ?? "").trim();
}

let cached: Resend | null = null;

function client(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Resend non configuré — RESEND_API_KEY manquante (voir .env.example).");
  }
  cached = new Resend(key);
  return cached;
}

export type RemoteContact = { id: string; email: string; unsubscribed: boolean };

async function listAudienceContacts(audienceId: string): Promise<RemoteContact[]> {
  const out: RemoteContact[] = [];
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await client().contacts.list({
      audienceId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error) throw new Error(`Resend contacts.list : ${error.name}`);
    for (const c of data?.data ?? []) {
      out.push({ id: c.id, email: c.email.trim().toLowerCase(), unsubscribed: c.unsubscribed });
    }
    if (!data?.has_more || (data?.data ?? []).length === 0) break;
    after = (data.data[data.data.length - 1] as RemoteContact).id;
  }
  return out;
}

type LocalUser = { email: string; displayName: string; eligible: boolean };

async function localUsers(): Promise<LocalUser[]> {
  const rows = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      digestOptOut: users.digestOptOut,
      deletedAt: users.deletedAt,
      bannedAt: users.bannedAt,
    })
    .from(users);
  return rows
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      displayName: r.displayName,
      eligible:
        r.digestOptOut === false &&
        r.deletedAt === null &&
        r.bannedAt === null &&
        r.email.trim() !== "" &&
        !r.email.trim().toLowerCase().endsWith("@placeholder.local"),
    }))
    .filter((u) => u.email !== "");
}

/**
 * Diff audience pur (testé) : que créer, que retirer, quels opt-out
 * locaux appliquer. `ineligible` = emails connus devenus inéligibles
 * (seuls retraits autorisés — les ajouts manuels dashboard sont
 * conservés).
 */
export function diffAudience(
  eligible: Map<string, string>,
  ineligible: Set<string>,
  remote: RemoteContact[],
): {
  toCreate: { email: string; displayName: string }[];
  toRemove: RemoteContact[];
  toOptOut: string[];
} {
  const toCreate: { email: string; displayName: string }[] = [];
  const toRemove: RemoteContact[] = [];
  const toOptOut: string[] = [];
  const seen = new Set<string>();
  for (const c of remote) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    if (c.unsubscribed && eligible.has(c.email)) {
      // Désinscription côté Resend = volonté explicite → vérité locale.
      toOptOut.push(c.email);
    } else if (!c.unsubscribed && ineligible.has(c.email)) {
      toRemove.push(c);
    }
  }
  for (const [email, displayName] of eligible) {
    if (!seen.has(email)) toCreate.push({ email, displayName });
  }
  return { toCreate, toRemove, toOptOut };
}

export async function syncNewsletterAudience(input?: {
  dryRun?: boolean;
}): Promise<{ eligible: number; created: number; removed: number; optedOut: number }> {
  const audienceId = newsletterAudienceId();
  if (audienceId === "") {
    throw new Error(
      "Audience non configurée — RESEND_AUDIENCE_ID manquante (voir docs/newsletter-operations.md).",
    );
  }
  const locals = await localUsers();
  const eligible = new Map<string, string>();
  const ineligible = new Set<string>();
  for (const u of locals) {
    if (u.eligible) eligible.set(u.email, u.displayName);
    else ineligible.add(u.email);
  }
  const remote = await listAudienceContacts(audienceId);
  const diff = diffAudience(eligible, ineligible, remote);
  if (input?.dryRun) {
    return {
      eligible: eligible.size,
      created: diff.toCreate.length,
      removed: diff.toRemove.length,
      optedOut: diff.toOptOut.length,
    };
  }
  let created = 0;
  for (const c of diff.toCreate) {
    try {
      const { error } = await client().contacts.create({
        audienceId,
        email: c.email,
        firstName: c.displayName.trim().slice(0, 80),
        unsubscribed: false,
      });
      if (error) throw new Error(error.name);
      created++;
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "newsletter.create" });
    }
  }
  let removed = 0;
  for (const c of diff.toRemove) {
    try {
      const { error } = await client().contacts.remove({ id: c.id, audienceId });
      if (error) throw new Error(error.name);
      removed++;
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "newsletter.remove" });
    }
  }
  let optedOut = 0;
  for (const email of diff.toOptOut) {
    try {
      await db.update(users).set({ digestOptOut: true }).where(eq(users.email, email));
      optedOut++;
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "newsletter.optout" });
    }
  }
  return { eligible: eligible.size, created, removed, optedOut };
}

/** Webhook `contact.updated` (désinscription via lien Resend) → opt-out local. */
export async function applyContactUnsubscribed(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (clean === "") return false;
  try {
    await db.update(users).set({ digestOptOut: true }).where(eq(users.email, clean));
    return true;
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "newsletter.webhook" });
    return false;
  }
}
