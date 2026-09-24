"use client";

/**
 * Persistance de l'état "code envoyé" (signin OTP) — le panneau meurt au
 * moindre refresh/recyclage d'onglet sinon (bug QA : code reçu, nulle
 * part où le taper). Deux niveaux :
 * - sessionStorage : refresh / retour arrière (meurt à la fermeture) ;
 * - localStorage borné 10 min (miroir OTP_TTL_MIN) : close/reopen.
 * Au-delà de 10 min : purge silencieuse (le code serveur est mort aussi).
 * Testé (verify script) — jamais de persistance au-delà de la validité.
 */

const SESSION_KEY = "builder-otp-pending-session";
const LOCAL_KEY = "builder-otp-pending-local";

export const OTP_PENDING_TTL_MS = 10 * 60 * 1000;

export type OtpPending = { email: string; at: number };

function readKey(key: string): OtpPending | null {
  try {
    const raw = (key === SESSION_KEY ? sessionStorage : localStorage).getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { email?: unknown }).email !== "string" ||
      typeof (parsed as { at?: unknown }).at !== "number"
    ) {
      return null;
    }
    const value = parsed as OtpPending;
    if (value.email.trim() === "" || Date.now() - value.at > OTP_PENDING_TTL_MS) {
      return null;
    }
    return { email: value.email, at: value.at };
  } catch {
    return null;
  }
}

/** Restauration : session d'abord (onglet courant), local ensuite. */
export function readOtpPending(): OtpPending | null {
  return readKey(SESSION_KEY) ?? readKey(LOCAL_KEY);
}

export function writeOtpPending(email: string): void {
  const value = JSON.stringify({ email, at: Date.now() });
  try {
    sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    /* private mode — le local prend le relais */
  }
  try {
    localStorage.setItem(LOCAL_KEY, value);
  } catch {
    /* private mode — session seule */
  }
}

export function clearOtpPending(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
