/**
 * Verdicts URL — partie PURE et client-safe (pastille formulaire, sans
 * jamais importer le service serveur : node:dns + Redis interdits dans
 * le bundle navigateur). Le service étend ce module, jamais l'inverse.
 */

export type UrlVerdict =
  | "ok"
  | "not_found"
  | "gone"
  | "auth_required"
  | "bot_blocked"
  | "server_error"
  | "timeout"
  | "dns_error"
  | "connection_error"
  | "private_host"
  | "invalid";

export type UrlPolicy = "ok" | "warn" | "block";

/**
 * Politique submit/profil — DURE (bloque) : ce qui ne marchera jamais
 * (malformé, host privé/local, DNS, timeout, connexion). DOUCE
 * (avertit, submit autorisé + flag revue) : ce qui est transitoire ou
 * privé-légitime (404/410, auth, bot, 5xx).
 */
export function classifyForSubmit(v: UrlVerdict): UrlPolicy {
  switch (v) {
    case "ok":
      return "ok";
    case "invalid":
    case "private_host":
    case "dns_error":
    case "timeout":
    case "connection_error":
      return "block";
    default:
      return "warn";
  }
}

const VERDICT_FR: Record<UrlVerdict, string> = {
  ok: "Lien joignable.",
  not_found: "Page introuvable (404) — vérifiez l'adresse.",
  gone: "Page retirée (410).",
  auth_required: "Accès restreint (privé ou protégé) — accepté, signalé à la revue.",
  bot_blocked: "Site anti-robots — invérifiable automatiquement, signalé à la revue.",
  server_error: "Le site ne répond pas correctement — réessayez plus tard.",
  timeout: "Délai dépassé — le site ne répond pas.",
  dns_error: "Domaine introuvable — vérifiez l'orthographe.",
  connection_error: "Connexion impossible — vérifiez l'adresse.",
  private_host: "Adresse locale ou privée interdite.",
  invalid: "Adresse invalide (http(s) uniquement).",
};

export function verdictMessage(v: UrlVerdict): string {
  return VERDICT_FR[v];
}

/** Validation de forme d'un store (Apple/Play…) — hosts + motif d'ID. */
export function matchStorePattern(
  raw: string,
  pattern: { hosts: string[]; idPattern: RegExp },
): boolean {
  let parsed: URL;
  try {
    parsed = new URL((raw ?? "").trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!pattern.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  return pattern.idPattern.test(parsed.toString());
}
