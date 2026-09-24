"use client";

import { getDaypartGreeting } from "@/lib/greeting";

/**
 * Salutation à l'heure RÉELLE du navigateur — micro-composant client pour
 * les shells serveur (le SSR ne connaît pas le fuseau du visiteur, et
 * aucun fuseau en dur n'est acceptable). `suppressHydrationWarning` :
 * le serveur rend avec son heure, le client corrige avant peinture —
 * pas de flash, pas d'avertissement.
 */
export function DaypartGreeting({ name }: { name: string }) {
  return (
    <span suppressHydrationWarning>
      {getDaypartGreeting()}, {name}
    </span>
  );
}
