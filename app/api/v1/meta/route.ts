import { apiCatch, apiOk, corsPreflight, methodNotAllowed } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import {
  APPEAL_COOLDOWN_MS,
  APPEAL_MAX_BYTES,
  APPEAL_MAX_FILES,
  EXPLANATION_MAX,
  EXPLANATION_MIN,
} from "@/services/appeals.service";
import { AVATAR_MAX_INPUT_BYTES } from "@/services/users.service";
import { DEFAULT_OCCUPATION_ID, OCCUPATIONS } from "@/config/occupations";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — référentiel en lecture seule.
export const POST = async () => methodNotAllowed(["GET"]);
export const PATCH = async () => methodNotAllowed(["GET"]);
export const DELETE = async () => methodNotAllowed(["GET"]);
export const PUT = async () => methodNotAllowed(["GET"]);

/**
 * Référentiel public de l'API v1 — vocabulaires fermés et limites, LUS
 * depuis les mêmes constantes que les services (zéro hardcode qui
 * dérive côté mobile : la liste des occupations ou une limite qui
 * change ici change partout). PAS d'auth (données publiques).
 * Versionné avec l'API : un changement de vocabulaire = bump v1→v2,
 * jamais de rupture silencieuse.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:meta:read", ip, { window: "60 s", max: 300 });
    }
    return apiOk({
      occupations: OCCUPATIONS.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
      })),
      defaultOccupation: DEFAULT_OCCUPATION_ID,
      providers: ["github", "google", "email"],
      limits: {
        avatarMaxBytes: AVATAR_MAX_INPUT_BYTES,
        appealMaxFiles: APPEAL_MAX_FILES,
        appealMaxBytes: APPEAL_MAX_BYTES,
        appealExplanationMin: EXPLANATION_MIN,
        appealExplanationMax: EXPLANATION_MAX,
        appealCooldownHours: APPEAL_COOLDOWN_MS / 3_600_000,
      },
    });
  } catch (e) {
    return apiCatch(e, "api.meta.get");
  }
}
