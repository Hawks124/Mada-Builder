import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { apiCatch, apiOk, methodNotAllowed } from "@/lib/api/response";

export const GET = async () => methodNotAllowed(["POST"]);

/**
 * Webhooks Resend (Lot 5) : délivrabilité réelle (delivered / bounced /
 * complained). `opened`/`clicked` IGNORÉS volontairement (pas de tracking
 * d'ouverture — §16). Secret `RESEND_WEBHOOK_SECRET` (whsec_…).
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
    const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
    if (!secret) return apiOk({ skipped: true });
    const body = await req.text();
    const id = req.headers.get("svix-id") ?? "";
    const timestamp = req.headers.get("svix-timestamp") ?? "";
    const signature = req.headers.get("svix-signature") ?? "";
    if (!id || !timestamp || !signature || !verifySvix(secret, id, timestamp, signature, body)) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHORIZED", message: "Signature invalide." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const payload = JSON.parse(body) as { type?: string; data?: { email_id?: string } };
    const status = payload.type ? HANDLED[payload.type] : undefined;
    const emailId = payload.data?.email_id;
    if (status && emailId) {
      await db.update(emailLogs).set({ status }).where(eq(emailLogs.resendId, emailId));
    }
    return apiOk({ received: true });
  } catch (e) {
    return apiCatch(e, "api.webhooks.resend");
  }
}
