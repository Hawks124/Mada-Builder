import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { ApiError } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { normalizeEmail, OtpError, verifyEmailCode } from "@/services/otp.service";
import { siteUrl } from "@/lib/site-url";
import { createStatelessClient } from "@/lib/supabase/stateless";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * OTP mobile (2/2) : vérifie le code puis ÉCHANGE contre une session
 * Supabase renvoyée en JSON (le client natif la stocke via `setSession`).
 * Mêmes règles que le web (TTL, tentatives, anti-oracle : erreur
 * générique "Code incorrect ou expiré." dans tous les cas).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:otp:verify", ip, { window: "60 s", max: 20 });
    }
    const body = await readJson(req);
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (email === "" || code === "") {
      throw new ApiError("VALIDATION", 422, "Code incorrect ou expiré.");
    }
    const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/")}`;
    let tokenHash: string;
    try {
      ({ tokenHash } = await verifyEmailCode({ email, code, redirectTo }));
    } catch (e) {
      if (e instanceof OtpError) throw new ApiError("VALIDATION", 422, "Code incorrect ou expiré.");
      throw e;
    }
    const supabase = createStatelessClient();
    for (const type of ["magiclink", "email"] as const) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error && data.session) {
        return apiOk({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          user: { id: data.session.user.id, email: data.session.user.email },
        });
      }
    }
    throw new ApiError("VALIDATION", 422, "Code incorrect ou expiré.");
  } catch (e) {
    return apiCatch(e, "api.otp.verify");
  }
}
