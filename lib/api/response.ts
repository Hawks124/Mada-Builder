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
  constructor(code: ApiErrorCode, status: number, message: string, data?: Record<string, unknown>) {
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

/**
 * Garde taille déclarée AVANT buffering multipart (Phase 6) : un client
 * annonçant 60 Mo ne doit jamais faire allouer 60 Mo — 413 franc sur le
 * `Content-Length` (absent = on laisse passer, le service valide après).
 */
export function assertContentLength(req: Request, maxBytes: number): void {
  const raw = req.headers.get("content-length");
  if (raw === null) return;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError("INVALID_BODY", 400, "Taille de requête illisible.");
  }
  if (n > maxBytes) {
    throw new ApiError(
      "VALIDATION",
      413,
      `Requête trop volumineuse (${Math.round(maxBytes / 1024 / 1024)} Mo maximum).`,
    );
  }
}

/** Budget multipart : logo 10 Mo + 6 captures 10 Mo + marge formulaire. */
export const MAX_PRODUCT_UPLOAD_BYTES = 72 * 1024 * 1024;
/** Avatar : 10 Mo + marge. */
export const MAX_AVATAR_UPLOAD_BYTES = 12 * 1024 * 1024;

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
 * Détail machine-readable d'une erreur (ex. `{ reason: "account_too_young" }`) :
 * objet simple uniquement, jamais de PII, jamais de stack. Le client matche
 * le code, pas le texte (textes FR modifiables sans casser le mobile).
 */
function toErrorData(details: unknown): Record<string, unknown> | undefined {
  if (details === null || details === undefined) return undefined;
  if (typeof details !== "object" || Array.isArray(details)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (typeof k !== "string" || k === "") continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Traduit une erreur service/action en réponse. ProfileError → code +
 * statut stables ; ApiError → tel quel ; inconnu → INTERNAL générique
 * (détail loggé Sentry, jamais renvoyé — §16).
 */ export function apiCatch(e: unknown, op: string): Response {
  if (e instanceof ApiError) {
    return apiError(e.code, e.message, e.status, e.data);
  }
  if (e instanceof ProfileError) {
    return apiError(e.code, e.message, PROFILE_STATUS[e.code], toErrorData(e.details));
  }
  captureError(e instanceof Error ? e : new Error(String(e)), { op });
  return apiError("INTERNAL", "Erreur interne. Réessayez dans un instant.", 500);
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
 * Cache HTTP lectures (Phase 6) : public partagé (CDN) vs privé.
 * - `PUBLIC_SHORT` (leaderboard-like, makers, fiches) : 60 s partagé + SWR.
 * - `PUBLIC_LONG` (référentiels quasi-statiques : meta) : 1 h + SWR jour.
 * - `PRIVATE` (me, dashboard, appels) : `no-store` EXPLICITE — jamais de
 *   donnée personnelle en cache partagé, même par accident.
 */
export const CACHE_PUBLIC_SHORT = "public, s-maxage=60, stale-while-revalidate=300";
export const CACHE_PUBLIC_LONG = "public, s-maxage=3600, stale-while-revalidate=86400";
export const CACHE_PRIVATE = "private, no-store";

export function withCache(res: Response, directive: string): Response {
  res.headers.set("Cache-Control", directive);
  return res;
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
