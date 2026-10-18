/**
 * Vocabulaire couleur et espacement des graduations.
 *
 * Sans `"use client"` ni JSX : `StatusPlot` est du HTML statique et ne doit pas
 * embarquer Recharts.
 *
 * Invariant : la couleur ne porte que ce qu'aucun texte ne porte. Un tracé
 * unique reste sur le premier plan — une teinte n'y décrirait rien.
 */

/** Séries du graphe d'activité : clics (blue) et téléchargements (violet).
 *  Le violet est choisi hors des familles de statut (vert/ambre/rouge) pour
 *  qu'une courbe ne soit jamais confondue avec un état. */
export const SERIES = {
  clicks: "var(--chart-clicks)",
  downloads: "var(--chart-downloads)",
} as const;

/** Réservé au statut. Aucune de ces trois teintes ne sert ailleurs. */
export const STATUS = {
  live: "var(--chart-live)",
  pending: "var(--chart-pending)",
  rejected: "var(--chart-rejected)",
} as const;

/** Indices de graduations espacées, extrémités incluses. Recharts n'espace pas
 *  les dates seul (`interval` peut poser deux ticks à 3 px). À convertir en
 *  libellés par l'appelant : l'axe X compare `ticks` aux valeurs de `dataKey`. */
export function tickIndices(count: number, max = 6): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

/** Nombre de dates selon la largeur mesurée. Nombre fixe = chevauchement au
 *  téléphone : Recharts écarte alors les graduations trop proches et supprime la
 *  première au lieu de résoudre. */
export function tickBudget(width: number): number {
  if (width <= 0) return 6;
  if (width < 420) return 3;
  if (width < 700) return 4;
  return 6;
}
