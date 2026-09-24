import { createClient } from "@/lib/supabase/server";
import { captureError, captureMessage } from "@/lib/monitoring";

/**
 * Échange server-side d'un hash Supabase (generateLink) contre une session
 * navigateur — via le client anon cookie-aware (setAll écrit les cookies
 * de session sur la réponse de l'action/route appelante).
 *
 * Pourquoi pas de navigation navigateur vers Supabase : le redirect de
 * retour (fragment vs query, token consommé, type, allowlist) a produit
 * des ?error=no_code opaques en QA. Ici : un seul appel API, succès ou
 * erreur typée, jamais d'URL à parser.
 *
 * Types tentés : 'magiclink' (génération) puis 'email' (assurance, loggée).
 */
export type ExchangeResult = { ok: true } | { ok: false; reason: string };

function logExchangeDev(message: string): void {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[auth:exchange] ${message}`);
}

export async function exchangeHashForSession(
  tokenHash: string,
): Promise<ExchangeResult> {
  if (!tokenHash) {
    logExchangeDev("hash vide");
    return { ok: false, reason: "empty" };
  }
  const supabase = await createClient();
  for (const type of ["magiclink", "email"] as const) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data.session) {
      if (type !== "magiclink") {
        captureMessage(`exchange: repli type '${type}'`, "warning");
      }
      return { ok: true };
    }
    const name = error?.name ?? "unknown";
    const code =
      typeof (error as { code?: unknown } | null)?.code === "string"
        ? (error as { code: string }).code
        : "";
    logExchangeDev(`${type} -> ${name}${code ? ` | ${code}` : ""}`);
    if (type === "email") {
      captureError(error ?? new Error("verifyOtp sans session"), {
        op: "auth.exchange",
      });
    }
  }
  return { ok: false, reason: "rejected" };
}
