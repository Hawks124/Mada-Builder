"use client";

const KEY = "mada-made:submit-draft:v1";

/**
 * Brouillon auto (création uniquement) : textes + sélections + listes,
 * jamais les fichiers (impossibles en localStorage — ils restent en
 * mémoire pendant l'envoi XHR). Effacé au succès, jamais en édition.
 */
export function saveSubmitDraft(form: HTMLFormElement): void {
  try {
    const fd = new FormData(form);
    const record: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v !== "string" || v === "") continue;
      if (k === "intent" || k === "productId") continue;
      if (!(k in record)) record[k] = v;
    }
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Stockage indisponible : silencieux (brouillon serveur inchangé).
  }
}

export function loadSubmitDraft(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export function clearSubmitDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Silencieux.
  }
}
