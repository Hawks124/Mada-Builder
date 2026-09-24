"use client";

/**
 * Garde anti-perte (navigation in-app) — le `beforeunload` natif ne couvre
 * QUE refresh/fermeture/lien externe : les navigations SPA (sidebar,
 * drawer) passent à côté. Ce registre comble le trou pour les zones
 * contrôlées (aujourd'hui : sidebar dashboard ↔ formulaire profil).
 *
 * Contrat : un formulaire sale s'enregistre (`registerUnsavedChecker`),
 * les navigations contrôlées consultent (`hasUnsavedChanges`) et
 * confirment via ConfirmDialog avant de partir. Rien d'enregistré =
 * navigation libre (zéro friction hors formulaires).
 */

type DirtyChecker = () => boolean;

const checkers = new Set<DirtyChecker>();

/** Enregistre un contrôle ; retourne la désinscription (useEffect). */
export function registerUnsavedChecker(checker: DirtyChecker): () => void {
  checkers.add(checker);
  return () => {
    checkers.delete(checker);
  };
}

/** Vrai si AU MOINS un formulaire enregistré est sale (jamais d'exception). */
export function hasUnsavedChanges(): boolean {
  for (const checker of checkers) {
    try {
      if (checker()) return true;
    } catch {
      // Checker fautif = ignoré (jamais bloquer une navigation sur bug).
    }
  }
  return false;
}
