import { checkLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/api/response";
import { captureError } from "@/lib/monitoring";

/**
 * Rate-limit API v1 — même façade Upstash que le web (fail-open +
 * warning Sentry, jamais de refus sur incident infra : un rate-limiter
 * en panne ne doit pas verrouiller les utilisateurs).
 * Fenêtres par endpoint (burst légitime vs abus) — lectures larges,
 * écritures étroites, fichiers très étroits (bande passante serveur).
 */
export const API_WINDOWS = {
  read: { window: "60 s", max: 120 },
  write: { window: "60 s", max: 20 },
  file: { window: "60 s", max: 10 },
  authSync: { window: "60 s", max: 30 },
} as const;

export async function apiLimit(
  namespace: string,
  userId: string,
  window: { window: `${number} ${"s" | "m" | "h" | "d"}`; max: number },
): Promise<void> {
  let allowed = true;
  try {
    ({ allowed } = await checkLimit({ namespace, id: userId, window }));
  } catch (e) {
    // Panne limiteur → on laisse passer (fail-open documenté).
    captureError(e instanceof Error ? e : new Error(String(e)), {
      op: `api.ratelimit:${namespace}`,
    });
    return;
  }
  if (!allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      429,
      "Trop de requêtes. Réessayez dans une minute.",
    );
  }
}
