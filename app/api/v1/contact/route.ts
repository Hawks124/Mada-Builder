import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { submitContact } from "@/services/contact.service";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

/**
 * Contact mobile (BÊTA web aussi) : même service que `/contact`
 * (validation, honeypot, rate-limit IP+email, file admin). SANS auth —
 * sponsors et partenaires ne sont pas forcément membres. Pas de
 * honeypot côté natif : champ `company` accepté et ignoré s'il est
 * vide (le clavier mobile ne le remplit jamais).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:contact:write", ip, { window: "60 s", max: 10 });
    }
    const body = await readJson(req);
    const str = (v: unknown): string => (typeof v === "string" ? v : "");
    const res = await submitContact({
      name: str(body.name),
      email: str(body.email),
      subject: str(body.subject),
      message: str(body.message),
      productUrl: str(body.productUrl),
      company: str(body.company),
      ip,
    });
    // Échec de validation = enveloppe d'erreur standard (ok:false,
    // code VALIDATION), pas un 200 déguisé : le natif matche le code.
    if (!res.ok) throw new ApiError("VALIDATION", 422, res.message);
    return apiOk({ sent: true }, 201);
  } catch (e) {
    return apiCatch(e, "api.contact.post");
  }
}
