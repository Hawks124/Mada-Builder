"use client";

import { ExclamationMarkIcon } from "@phosphor-icons/react";

/**
 * Bandeau mode dégradé — affiché quand la session n'a pas pu être VÉRIFIÉE
 * (incident réseau, pas invité prouvé) : les données visibles sont des
 * mocks, et l'utilisateur doit le SAVOIR (sinon "Kaliana R." affiché à
 * Adam = mensonge). Fail-open techniquement sûr, honnête visuellement.
 */
export function DegradedBanner() {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 text-[12px] font-bold text-amber-700 dark:text-amber-400"
    >
      <ExclamationMarkIcon weight="bold" className="h-3.5 w-3.5 shrink-0" />
      Connexion instable — affichage de démonstration.
    </p>
  );
}
