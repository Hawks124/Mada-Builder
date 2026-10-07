import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { ApiError } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { normalizeEmail, OtpError, requestEmailCode } from "@/services/otp.service";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { discardEmailCode, OTP_TTL_MIN } from "@/services/otp.service";
import { otpEmailHtml, otpEmailSubject, otpEmailText } from "@/lib/email-templates/otp-email";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * OTP mobile (1/2) : envoie le code 6 chiffres (Resend, FR). Mêmes règles
 * que le web (throttle, anti-énumération, TTL) — seule la sortie change
 * (JSON, pas de cookies). Le `redirectTo` est factice (le lien magique
 * ne sert pas au mobile) mais requis par le service.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:otp:request", ip, { window: "60 s", max: 10 });
    }
    const body = await readJson(req);
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    if (!zEmailOk(email)) {
      throw new ApiError("VALIDATION", 422, "Adresse email invalide.");
    }
    const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/")}`;
    let code: string;
    try {
      const issued = await requestEmailCode({ email, redirectTo });
      code = issued.code;
    } catch (e) {
      if (e instanceof OtpError && e.reason === "throttled") {
        return apiOk({ ok: true });
      }
      throw e;
    }
    try {
      await sendEmail({
        to: email,
        subject: otpEmailSubject(),
        template: "otp",
        html: otpEmailHtml({
          code,
          validityMinutes: OTP_TTL_MIN,
          actionLink: null,
          origin: siteUrl(),
        }),
        text: otpEmailText({
          code,
          validityMinutes: OTP_TTL_MIN,
          actionLink: null,
          origin: siteUrl(),
        }),
      });
    } catch (e) {
      await discardEmailCode(email);
      throw e;
    }
    return apiOk({ ok: true });
  } catch (e) {
    if (e instanceof OtpError) {
      return apiOk({ ok: true });
    }
    return apiCatch(e, "api.otp.request");
  }
}

function zEmailOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
