import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { Redis } from "@upstash/redis";
import { captureError } from "@/lib/monitoring";
import {
  classifyForSubmit,
  matchStorePattern,
  verdictMessage,
  type UrlPolicy,
  type UrlVerdict,
} from "@/lib/url-verdict";

export { classifyForSubmit, matchStorePattern, verdictMessage, type UrlPolicy, type UrlVerdict };

/**
 * Vérification d'URL à la volée (formulaires submit/profil, API mobile) —
 * pour qu'aucun lien cassé n'atteigne la revue admin. Pur + testable
 * (voir scripts/verify-url-check.ts : serveur loopback éphémère).
 *
 * Pipeline : normalisation → scheme http(s) → blocage hôtes locaux →
 * DNS → validation IP (chaque hop) → HEAD (repli GET sans body) →
 * redirects max 5 re-validées → classification. JAMAIS de body stocké
 * ni renvoyé (pas de proxy ouvert, pas d'exfiltration).
 *
 * Sécurité (l'endpoint fetch des URLs attaquantes) : allowlist de scheme,
 * blocklist d'hôtes, validation DNS→IP systématique (v4+v6), timeouts
 * bornés, body annulé, rate-limit + cache global par URL (anti-martèlement
 * : cooldown global, pas seulement par user). Résiduel assumé V1 :
 * TOCTOU DNS (re-résolution entre check et fetch) — vrai fix = agent
 * dial custom, plus tard.
 */

export type UrlCheckResult = {
  verdict: UrlVerdict;
  /** Statut HTTP final (null si pas de réponse). */
  status: number | null;
  /** URL finale après redirects (null si échec précoce). */
  finalUrl: string | null;
  /** Servi du cache (pas de fetch sortant). */
  cached: boolean;
};

export type UrlSeverity = "ok" | "warn" | "block";

export const URL_CHECK_TTL_S = 24 * 3600;
/** Erreurs transitoires : re-vérifiées vite (pas de 24 h sur un hoquet). */
export const URL_CHECK_ERROR_TTL_S = 300;
const TRANSIENT: ReadonlySet<UrlVerdict> = new Set([
  "timeout",
  "dns_error",
  "connection_error",
  "server_error",
  "bot_blocked",
]);
const HEAD_TIMEOUT_MS = 4000;
const GET_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 1024 * 1024;
const USER_AGENT =
  "MadaMade-LinkCheck/1.0 (link verification; https://github.com/Hawks124/Mada-Builder)";

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];
const BLOCKED_EXACT = new Set(["localhost"]);

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

let redis: Redis | null | undefined;
function cacheClient(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** IPv4 privée/bouclage/lien-local/multicast/réservée (littéraux hexadécimaux et décimaux couverts via lookup). */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const n = parts.map((p) => Number(p));
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = n;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a >= 224) return true;
  return false;
}

/** IPv6 bouclage/lien-local/unique-local/multicast/non-global. */
function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fe80:")) return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("ff")) return true;
  if (v.startsWith("::ffff:")) {
    return isPrivateIPv4(v.slice("::ffff:".length));
  }
  return false;
}

function isPrivateIP(family: number, address: string): boolean {
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

function hostBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (host === "" || BLOCKED_EXACT.has(host)) return true;
  if (!host.includes(".") && !host.includes(":")) return true; // single-label
  return BLOCKED_SUFFIXES.some((s) => host.endsWith(s));
}

/** Résout + exige TOUTES les adresses publiques (un enregistrement privé parmi d'autres = refus). */
async function assertPublicHost(hostname: string): Promise<void> {
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(hostname, { all: true });
  } catch {
    // Échec DNS d'un hôte à allure numérique (décimal, hexadécimal) =
    // tentative d'évasion loopback, pas un vrai domaine : refus fermé
    // (fail-closed), jamais un "domaine introuvable" bénin.
    if (isNumericHost(hostname)) {
      const err = new Error("private") as Error & { code?: string };
      err.code = "PRIVATE_HOST";
      throw err;
    }
    const err = new Error("dns") as Error & { code?: string };
    err.code = "DNS_ERROR";
    throw err;
  }
  if (records.length === 0 || records.some((r) => isPrivateIP(r.family, r.address))) {
    const err = new Error("private") as Error & { code?: string };
    err.code = "PRIVATE_HOST";
    throw err;
  }
}

/** Allure numérique (décimal "2130706433", hexadécimal, pointé) — formes d'évasion loopback. */
function isNumericHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.+$/, "");
  return /^(0x[0-9a-f.]+|\d+(\.\d+)*|[0-9a-f:]+)$/.test(host);
}

function classifyStatus(status: number): UrlVerdict {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "auth_required";
  if (status === 404) return "not_found";
  if (status === 410) return "gone";
  if (status === 429) return "bot_blocked";
  if (status >= 500) return "server_error";
  return "server_error";
}

async function fetchStatus(url: string): Promise<{ status: number; headers: Headers }> {
  // HEAD d'abord (pas cher) ; repli GET sans body si refusé.
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    });
    if (head.status !== 405 && head.status !== 501) {
      await head.body?.cancel().catch(() => {});
      return { status: head.status, headers: head.headers };
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      const err = new Error("timeout") as Error & { code?: string };
      err.code = "TIMEOUT";
      throw err;
    }
    if ((e as Error & { code?: string })?.code === "TIMEOUT") throw e;
    // Réseau coupé ici = on retente en GET (TLS/SNI capricieux en HEAD).
  }
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "*/*", Range: "bytes=0-1023" },
  });
  try {
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) {
      await res.body?.cancel().catch(() => {});
      return { status: res.status, headers: res.headers };
    }
    const reader = res.body?.getReader();
    if (reader) {
      let seen = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        seen += value.byteLength;
        if (seen > MAX_BODY_BYTES) break;
      }
      await reader.cancel().catch(() => {});
    }
  } finally {
    await res.body?.cancel().catch(() => {});
  }
  return { status: res.status, headers: res.headers };
}

export type CheckUrlOptions = {
  /** Bypass du cache (resoumission). */
  force?: boolean;
  /** Boucle locale des tests UNIQUEMENT — jamais exposé par l'endpoint. */
  allowPrivateHosts?: boolean;
};

function cacheKey(normalized: string): string {
  return `urlcheck:v1:${sha256(normalized)}`;
}

/**
 * Vérifie une URL collée (formulaire). Normalise scheme+host pour la clé
 * de cache (le path reste sensible à la casse pour le fetch).
 */
export async function checkUrl(raw: string, opts: CheckUrlOptions = {}): Promise<UrlCheckResult> {
  const trimmed = (raw ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { verdict: "invalid", status: null, finalUrl: null, cached: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { verdict: "invalid", status: null, finalUrl: null, cached: false };
  }
  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
  const key = cacheKey(
    `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}`,
  );

  const cache = cacheClient();
  if (!opts.force && cache) {
    try {
      const hit = await cache.get<{ v: UrlVerdict; s: number | null; f: string | null }>(key);
      if (hit) {
        return { verdict: hit.v, status: hit.s, finalUrl: hit.f, cached: true };
      }
    } catch {
      // Cache en panne : on vérifie quand même (fail-open documenté).
    }
  }

  const finish = async (
    verdict: UrlVerdict,
    status: number | null,
    finalUrl: string | null,
  ): Promise<UrlCheckResult> => {
    if (cache) {
      try {
        await cache.set(
          key,
          { v: verdict, s: status, f: finalUrl },
          { ex: TRANSIENT.has(verdict) ? URL_CHECK_ERROR_TTL_S : URL_CHECK_TTL_S },
        );
      } catch (e) {
        captureError(e instanceof Error ? e : new Error(String(e)), { op: "urlcheck.cache" });
      }
    }
    return { verdict, status, finalUrl, cached: false };
  };

  let current = normalized;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = new URL(current);
      let status: number;
      let headers: Headers;
      try {
        // Validation AVANT fetch, dans le même try que le mapping :
        // sinon les refus tombent dans le catch externe (connection_error
        // générique) au lieu de leur verdict précis.
        if (!opts.allowPrivateHosts) {
          if (hostBlocked(u.hostname)) return finish("private_host", null, null);
          await assertPublicHost(u.hostname);
        }
        ({ status, headers } = await fetchStatus(current));
      } catch (e) {
        const code = (e as Error & { code?: string })?.code;
        if (code === "TIMEOUT") return finish("timeout", null, null);
        if (code === "DNS_ERROR") return finish("dns_error", null, null);
        if (code === "PRIVATE_HOST") return finish("private_host", null, null);
        return finish("connection_error", null, null);
      }
      if (status >= 300 && status < 400) {
        if (hop === MAX_REDIRECTS) return finish("server_error", status, current);
        // Location lue sur LA réponse déjà reçue (pas de 2e fetch) —
        // relatives incluses, hop suivant re-validé (host + IP).
        const location = headers.get("location");
        if (!location) return finish("server_error", status, current);
        try {
          current = new URL(location, current).toString();
        } catch {
          return finish("invalid", status, null);
        }
        continue;
      }
      // 403 = privé légitime OU filtre anti-bot (indistinguables sans
      // heuristique hasardeuse) : avertissement, jamais blocage — voir
      // classifyForSubmit + message honnête ci-dessous.
      return finish(classifyStatus(status), status, current);
    }
    return finish("server_error", null, current);
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "urlcheck.fetch" });
    return finish("connection_error", null, null);
  }
}

/** Bot-détecté vs privé : même verdict, message honnête (voir appelant). */
export function isAuthOrBot(v: UrlVerdict): boolean {
  return v === "auth_required" || v === "bot_blocked";
}

/**
 * Verdicts en masse (cockpit admin : re-vérification fraîche au chargement
 * de la fiche). Cache-first : URLs déjà vues = pas de fetch. Jamais de
 * throw (incident isolé par URL → connection_error).
 */
export async function getLinkVerdicts(
  values: Record<string, string | undefined>,
): Promise<Record<string, UrlCheckResult>> {
  const entries = Object.entries(values).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
  );
  const out: Record<string, UrlCheckResult> = {};
  await Promise.all(
    entries.map(async ([id, url]) => {
      try {
        out[id] = await checkUrl(url);
      } catch {
        out[id] = { verdict: "connection_error", status: null, finalUrl: null, cached: false };
      }
    }),
  );
  return out;
}
