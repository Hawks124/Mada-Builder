/**
 * HTTP provider facturation (Phase 2 MRR) : timeouts, erreurs sanitisées,
 * jamais de secret dans les messages. Chaque sync horaire passe par ici.
 */

export class RevenueFetchError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  constructor(message: string, status: number | null = null, retryable = false) {
    super(message);
    this.name = "RevenueFetchError";
    this.status = status;
    this.retryable = retryable;
  }
}

export async function providerGetJson(
  url: string,
  opts: {
    providerLabel: string;
    bearer: string;
    accept?: string;
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
  },
): Promise<unknown> {
  const { providerLabel, bearer, timeoutMs = 20_000 } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: opts.accept ?? "application/json",
        ...opts.extraHeaders,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new RevenueFetchError(
        `${providerLabel} : délai dépassé, réessai à la prochaine sync.`,
        null,
        true,
      );
    }
    throw new RevenueFetchError(
      `${providerLabel} : réseau injoignable, réessai à la prochaine sync.`,
      null,
      true,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new RevenueFetchError(
      `${providerLabel} : clé refusée ou permissions insuffisantes — reconnectez depuis la fiche.`,
      res.status,
      false,
    );
  }
  if (res.status === 429) {
    throw new RevenueFetchError(
      `${providerLabel} : limite de débit atteinte, réessai à la prochaine sync.`,
      429,
      true,
    );
  }
  if (!res.ok) {
    throw new RevenueFetchError(
      `${providerLabel} : erreur ${res.status}, réessai à la prochaine sync.`,
      res.status,
      res.status >= 500,
    );
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new RevenueFetchError(`${providerLabel} : réponse illisible.`, null, true);
  }
}

/** Facteur de mensualisation (montant par intervalle → mensuel). */
export function monthlyFactor(intervalUnit: string, intervalCount: number): number | null {
  const days: Record<string, number> = {
    day: 1,
    daily: 1,
    week: 7,
    weekly: 7,
    month: 30.4375,
    monthly: 30.4375,
    year: 365.25,
    annual: 365.25,
    yearly: 365.25,
  };
  const per = days[intervalUnit];
  if (!per || !(intervalCount > 0) || !Number.isFinite(intervalCount)) return null;
  return 365.25 / per / 12 / intervalCount;
}

export function assertCurrency(code: unknown): string {
  if (typeof code === "string" && /^[A-Z]{3}$/.test(code)) return code;
  throw new RevenueFetchError(`Devise provider illisible (${String(code)}).`);
}

export function assertNonNegativeInt(n: unknown, what: string): number {
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.round(n);
  throw new RevenueFetchError(`Montant provider illisible (${what}).`);
}
