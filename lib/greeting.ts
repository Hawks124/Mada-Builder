/**
 * Salutation dynamique (Bonjour/Bonsoir) — vocabulaire fermé, jamais de
 * texte libre (pas d'injection possible dans les emails).
 *
 * Fuseau TOUJOURS explicite côté serveur (Vercel = UTC) : l'appelant
 * fournit le fuseau IANA réel (colonne users.time_zone, captée
 * navigateur). Repli = UTC neutre, jamais une localité : un repli
 * géographique mentirait en se faisant passer pour l'heure de
 * l'utilisateur. Côté navigateur, omettre `timeZone` = heure locale
 * réelle de l'utilisateur.
 * Bornes : 05:00–17:59 Bonjour, 18:00–04:59 Bonsoir. Deux variantes
 * seulement (pas de "Bonne nuit" : déplacé dans un email relu plus tard).
 */

export const FALLBACK_TIME_ZONE = "UTC";

export type DaypartGreeting = "Bonjour" | "Bonsoir";

function hourInZone(now: Date, timeZone: string | undefined): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      hour: "numeric",
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (Number.isFinite(hour)) return hour % 24;
  } catch {
    // Fuseau invalide (RangeError) : repli heure locale, jamais de crash.
  }
  return now.getHours();
}

export function getDaypartGreeting(now: Date = new Date(), timeZone?: string): DaypartGreeting {
  const h = hourInZone(now, timeZone);
  return h >= 5 && h < 18 ? "Bonjour" : "Bonsoir";
}

/** Raccourci serveur : fuseau réel du destinataire, repli neutre. */
export function emailGreeting(timeZone?: string | null): DaypartGreeting {
  return getDaypartGreeting(new Date(), timeZone ?? FALLBACK_TIME_ZONE);
}
