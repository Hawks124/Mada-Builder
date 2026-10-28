import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { apiCatch, apiOk, methodNotAllowed, ApiError } from "@/lib/api/response";

export const GET = async () => methodNotAllowed(["POST"]);

/**
 * Webhooks Resend (Lot 5 + Phase 2 newsletter) : délivrabilité réelle
 * (delivered / bounced / complained) + désinscriptions audience
 * (`contact.updated` avec `unsubscribed: true` → `digest_opt_out` local).
 * `opened`/`clicked` IGNORÉS volontairement (pas de tracking
 * d'ouverture — §16). Secret `RESEND_WEBHOOK_SECRET` (whsec_…).
 * Lot B : sans secret configuré → 503 franche (fail closed, avant :
 * 200 menteur) + fenêtre anti-replay ±5 min sur `svix-timestamp`.
 * Échec de vérif = 401 (Resend retry) ; payload inconnu = 200 (pas de
 * retry inutile). `email_id` Resend ↔ `resend_id` des logs.
 */
const HANDLED: Record<string, "delivered" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function verifySvix(
  secret: string,
  id: string,
  timestamp: string,
  signature: string,
  body: string,
): boolean {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  for (const part of signature.split(" ")) {
    const sig = part.startsWith("v1,") ? part.slice(3) : part;
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // Format invalide : essayer la suivante.
    }
  }
  return false;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
    if (!secret) {
      // Fail-closed (lot B) : avant, sans secret configuré la route
      // répondait 200 (`skipped`) — fail-open : n'importe qui pouvait
      // poster des événements forgés (stats email polluées, désinscriptions
      // activées de l'extérieur) et le vrai webhook est silencieux. Même
      // pattern que les routes cron : 503 franche.
      throw new ApiError("INTERNAL", 503, "Webhook non configuré.");
    }
    const body = await req.text();
    const id = req.headers.get("svix-id") ?? "";
    const timestamp = req.headers.get("svix-timestamp") ?? "";
    const signature = req.headers.get("svix-signature") ?? "";
    // Fenêtre anti-replay (lot B) : la recommandation svix est de ±5 min.
    // Au-delà, un body rejoué à froid porte un timestamp périmé (401 →
    // Resend réessaie) — un body capté un jour ne sert plus rien.
    const tsSeconds = Number(timestamp);
    const fresh = Number.isFinite(tsSeconds) && Math.abs(Date.now() / 1000 - tsSeconds) <= 300;
    if (
      !id ||
      !timestamp ||
      !signature ||
      !fresh ||
      !verifySvix(secret, id, timestamp, signature, body)
    ) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", message: "Signature invalide." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const payload = JSON.parse(body) as {
      type?: string;
      data?: {
        email_id?: string;
        email?: string;
        unsubscribed?: boolean;
        audience_id?: string;
      };
    };
    const status = payload.type ? HANDLED[payload.type] : undefined;
    const emailId = payload.data?.email_id;
    if (status && emailId) {
      await db.update(emailLogs).set({ status }).where(eq(emailLogs.resendId, emailId));
    }
    // Désinscription via lien Resend (one-shot) : la vérité locale suit.
    // Audience étrangère = ignorée (une seule audience pilotée).
    if (
      payload.type === "contact.updated" &&
      payload.data?.unsubscribed === true &&
      typeof payload.data?.email === "string"
    ) {
      const want = (process.env.RESEND_AUDIENCE_ID ?? "").trim();
      if (want === "" || payload.data.audience_id === want) {
        const { applyContactUnsubscribed } = await import("@/services/newsletter.service");
        await applyContactUnsubscribed(payload.data.email);
      }
    }
    return apiOk({ received: true });
  } catch (e) {
    return apiCatch(e, "api.webhooks.resend");
  }
}
