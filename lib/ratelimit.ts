import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { captureMessage } from "@/lib/monitoring";

/**
 * Façade rate-limit (Upstash Redis) — FONDATION partagée, pas une rustine.
 * Votes, soumissions et tout futur endpoint mutant brancheront leurs
 * fenêtres sur `checkLimit` — aucune nouvelle infra à ce moment-là.
 * Promis publiquement (confidentialite.md : lutte anti-anneaux de vote).
 *
 * Politique de dégradation : fail-open + warning Sentry si Redis est
 * injoignable (disponibilité > strict à volume V1 ; le burn tentatives +
 * l'expiry bornent déjà le coût d'une attaque). Les clés sont exigées en
 * prod via UPSTASH_REDIS_REST_URL/TOKEN (voir .env.example).
 */
let redis: Redis | null = null;

function client(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    captureMessage("Upstash non configuré — rate-limit désactivé", "warning");
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

export type LimitWindow = {
  /** Fenêtre glissante, ex. "60 s", "10 m", "1 h" (syntaxe Upstash). */
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  max: number;
};

const limiters = new Map<string, Ratelimit>();

function limiterFor(namespace: string, window: LimitWindow): Ratelimit | null {
  const db = client();
  if (!db) return null;
  const cacheKey = `${namespace}:${window.window}:${window.max}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: db,
    limiter: Ratelimit.slidingWindow(window.max, window.window),
    prefix: "builder",
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Clé stable et testable : `namespace:id-normalisé`.
 * L'id est trimmé + lowercasé (emails) — jamais de PII en log, §16.
 */
export function buildLimitKey(namespace: string, id: string): string {
  return `${namespace.trim()}:${id.trim().toLowerCase()}`;
}

/**
 * `allowed=false` → l'appelant répond sa propre erreur générique
 * (ex. OtpError "throttled" → OK silencieux côté action).
 */
export async function checkLimit(input: {
  namespace: string;
  id: string;
  window: LimitWindow;
}): Promise<{ allowed: boolean }> {
  const limiter = limiterFor(input.namespace, input.window);
  if (!limiter) return { allowed: true };
  try {
    const { success } = await limiter.limit(
      buildLimitKey(input.namespace, input.id),
    );
    return { allowed: success };
  } catch {
    captureMessage("Upstash injoignable — rate-limit contourné", "warning");
    return { allowed: true };
  }
}
