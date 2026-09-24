import { ProfileError } from "@/services/users.service";
import { captureError } from "@/lib/monitoring";

/**
 * Socle HTTP de l'API v1 (mobile) — AUCUN import `next/*` ici (Response
 * et Request globaux uniquement) : les helpers restent testables en
 * tsx pur via scripts/verify-api-v1, sans serveur.
 *
 * Enveloppe unique : `{ ok: true, data }` / `{ ok: false, code, message }`.
 * `code` STABLE (le switch Dart s'appuie dessus, jamais sur le message FR).
 * Dates toujours sérialisées ISO côté routes (jamais de Date brute).
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BANNED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "FILE_REJECTED"
  | "RATE_LIMITED"
  | "INVALID_BODY"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly data?: Record<string, unknown>;
  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

const PROFILE_STATUS: Record<ProfileError["code"], number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  FILE_REJECTED: 422,
};

export function apiOk<T>(data: T, status = 200): Response {
  return corsJson({ ok: true, data }, status);
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  data?: Record<string, unknown>,
): Response {
  const body: Record<string, unknown> = { ok: false, code, message };
  if (data !== undefined) body.data = data;
  return corsJson(body, status);
}

/**
 * Traduit une erreur service/action en réponse. ProfileError → code +
 * statut stables ; ApiError → tel quel ; inconnu → INTERNAL générique
 * (détail loggé Sentry, jamais renvoyé — §16).
 */
export function apiCatch(e: unknown, op: string): Response {
  if (e instanceof ApiError) {
    return apiError(e.code, e.message, e.status, e.data);
  }
  if (e instanceof ProfileError) {
    return apiError(e.code, e.message, PROFILE_STATUS[e.code]);
  }
  captureError(e instanceof Error ? e : new Error(String(e)), { op });
  return apiError(
    "INTERNAL",
    "Erreur interne. Réessayez dans un instant.",
    500,
  );
}

/**
 * Corps JSON strict : Content-Type non JSON, JSON malformé, ou racine
 * non-objet → INVALID_BODY 400 (jamais de crash sur `request.json()`).
 * Les schémas Zod des services strippent les clés inconnues (whitelist).
 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new ApiError("INVALID_BODY", 400, "Corps JSON invalide.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError("INVALID_BODY", 400, "Corps JSON invalide.");
  }
  return parsed as Record<string, unknown>;
}

/** Multipart strict : champ présent, non vide. */
export function requireFile(form: FormData, field: string): File {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError("VALIDATION", 422, "Fichier manquant ou vide.");
  }
  return file;
}

// ── CORS ────────────────────────────────────────────────────────────────
// Apps natives : pas de preflight (politique navigateur uniquement).
// Headers minimaux quand même (assurance Flutter Web futur + outils).
// `*` sans credentials : aucune donnée sensible exposée au partage
// (l'auth passe par Bearer, jamais par cookie).
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Pré-réponse preflight — `export const OPTIONS` de chaque route v1. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * 405 JSON — Next répond du HTML aux mauvaises méthodes sur route
 * existante (le parse JSON mobile casse). Chaque route v1 exporte les
 * méthodes non gérées vers ici. `Allow` rappelle le contrat.
 */
export function methodNotAllowed(allowed: string[]): Response {
  const res = apiError(
    "METHOD_NOT_ALLOWED",
    `Méthode non supportée. Autorisées : ${allowed.join(", ")}.`,
    405,
  );
  res.headers.set("Allow", [...allowed, "OPTIONS"].join(", "));
  return res;
}

/** Sérialisation dates → ISO (racines + nulls). */
export function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}
