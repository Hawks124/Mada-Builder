import { apiError, corsPreflight } from "@/lib/api/response";

export const OPTIONS = async () => corsPreflight();

/**
 * 404 JSON de l'API v1 — un client mobile parse du JSON, jamais du
 * HTML : toute route /api/v1/* inconnue répond l'enveloppe d'erreur
 * (pas la 404 HTML de Next). Ne capte QUE les sous-chemins non mappés.
 */
async function unknown(req: Request): Promise<Response> {
  let path = "/api/v1/…";
  try {
    path = new URL(req.url).pathname;
  } catch {
    // URL illisible : libellé générique, jamais de crash.
  }
  return apiError(
    "NOT_FOUND",
    `Endpoint inconnu (${path}). Référence : docs/mobile-contrats.md.`,
    404,
  );
}

export const GET = unknown;
export const POST = unknown;
export const PATCH = unknown;
export const PUT = unknown;
export const DELETE = unknown;
