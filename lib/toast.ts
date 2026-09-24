/**
 * Canal toast partagé — feedback post-redirect (le param URL survit aux
 * redirect serveur, l'état local non). Règle (docs/auth.md) :
 * redirect → ?toast= ; même page → message inline (formulaires).
 *
 * Sécurité : tones en allowlist, message en nœud texte uniquement
 * (jamais de HTML injecté), tronqué à 120 signes.
 */

export const TOAST_TONES = ["ok", "err", "info"] as const;
export type ToastTone = (typeof TOAST_TONES)[number];

export const TOAST_PARAM = "toast";
const MAX_MESSAGE_LENGTH = 120;

export function isToastTone(value: unknown): value is ToastTone {
  return typeof value === "string" && (TOAST_TONES as readonly string[]).includes(value);
}

/** Parse `ok:Message` (+ fallback info si tone inconnu). */
export function parseToastParam(raw: string | null): {
  tone: ToastTone;
  message: string;
} | null {
  if (!raw) return null;
  const sep = raw.indexOf(":");
  const tone = sep < 0 ? raw : raw.slice(0, sep);
  const message = (sep < 0 ? "" : raw.slice(sep + 1)).trim();
  if (message === "") return null;
  return {
    tone: isToastTone(tone) ? tone : "info",
    message: message.slice(0, MAX_MESSAGE_LENGTH),
  };
}

/** Construit une URL (relative ou absolue) avec ?toast=tone:message. */
export function withToast(href: string, tone: ToastTone, message: string): string {
  const clean = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${TOAST_PARAM}=${encodeURIComponent(`${tone}:${clean}`)}`;
}
