import { apiCatch, methodNotAllowed } from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { captureError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Endpoint `report-uri` de la CSP (Report-Only au lancement du lot C) :
 * on COLLECTE les violations sans bloquer — le flip en enforce se décide
 * après revue des reports (docs/architecture.md, ring headers).
 * Rate-limit IP serré : un navigateur qui déclenche beaucoup de
 * violations en boucle ne doit pas inonder Sentry.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip) {
      await apiLimit("api:csp:report", ip, { window: "60 s", max: 30 });
    }
    let violatedDirective = "?";
    let documentUri = "?";
    try {
      // La spec W3C enveloppe le report dans un objet racine
      // `csp-report` ; certains agents plus récents postent les champs à
      // la racine, ou un TABLEAU de reports — on lit l'enveloppe
      // d'abord, la racine en repli, jamais de crash sur la forme.
      const raw = (await req.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
      const outer = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
      const env = outer["csp-report"];
      const report =
        env instanceof Object && !Array.isArray(env) ? (env as Record<string, unknown>) : outer;
      const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
      violatedDirective =
        str(report["violated-directive"]) ?? str(report["effective-directive"]) ?? "?";
      documentUri = str(report["document-uri"]) ?? "?";
    } catch {
      // Corps non JSON : signal de spam — 204 sans log (au fond, ne casse
      // jamais la page qui a déclenché).
    }
    if (violatedDirective !== "?") {
      captureError(new Error(`CSP violation : ${violatedDirective}`), {
        op: "api.csp.report",
        documentUri,
      });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return apiCatch(e, "api.csp.report");
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowed(["POST"]);
}
