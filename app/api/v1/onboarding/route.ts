import { apiCatch, apiOk, corsPreflight, methodNotAllowed, readJson } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/auth";
import { API_WINDOWS, apiLimit } from "@/lib/api/ratelimit";
import {
  completeProfile,
  getOnboardingFormData,
  getOnboardingStatus,
} from "@/services/users.service";

export const OPTIONS = async () => corsPreflight();

// 405 JSON — lecture + complétion uniquement.
export const PATCH = async () => methodNotAllowed(["GET", "POST"]);
export const DELETE = async () => methodNotAllowed(["GET", "POST"]);
export const PUT = async () => methodNotAllowed(["GET", "POST"]);

/**
 * Statut onboarding — MÊME prédicat que la gate web
 * (`getOnboardingStatus` : flag ET données propres). Le mobile affiche
 * son écran bienvenue quand `done === false`, avec `missing` +
 * `form` (pré-remplissage, email vidé si placeholder).
 * Autorisé banni : un banni au placeholder doit pouvoir fixer son
 * email (appel/suppression exigent un contact réel).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:onboarding:read", user.id, API_WINDOWS.read);
    const [status, form] = await Promise.all([
      getOnboardingStatus(user.id),
      getOnboardingFormData(user.id),
    ]);
    return apiOk({
      done: status.done,
      missing: status.missing,
      form: form
        ? {
            email: form.email,
            displayName: form.displayName,
            occupation: form.occupation,
            provider: form.provider,
            username: form.username,
            avatarUrl: form.avatarUrl,
          }
        : null,
    });
  } catch (e) {
    return apiCatch(e, "api.onboarding.get");
  }
}

/**
 * Complétion onboarding — mêmes règles que `/bienvenue` (nom ≥ 2,
 * email réel si placeholder, occupation vocabulaire fermé, anti-squat
 * case-insensitive). Réponse = `done` recalculé (le client n'a pas à
 * deviner la suite : `done === true` → home, sinon rester).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireApiUser(req, { allowBanned: true });
    await apiLimit("api:onboarding:write", user.id, API_WINDOWS.write);
    const body = await readJson(req);
    const { username } = await completeProfile(user.id, user.id, body);
    const status = await getOnboardingStatus(user.id);
    return apiOk({ username, done: status.done, missing: status.missing });
  } catch (e) {
    return apiCatch(e, "api.onboarding.post");
  }
}
