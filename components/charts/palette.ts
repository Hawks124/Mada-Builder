/**
 * Vocabulaire couleur et espacement des graduations.
 *
 * Volontairement sans `"use client"` ni JSX : `StatusPlot` est du HTML statique
 * et ne doit pas devenir un composant client sous peine d'embarquer Recharts
 * dans le bundle d'un panneau purement textuel.
 *
 * Règle du dépôt : la couleur ne porte que ce qu'aucun texte ne peut porter. Le
 * statut est le seul cas, plus la seule paire de séries qui se croise — pour
 * tout le reste, le zinc suffit et le monochrome reste lisible.
 */

/**
 * Teintes de données.
 *
 * `clicks` est le seul bleu du dépôt : les clics sont la seule série qui en
 * croise une autre dans la même aire, donc la seule où lire « laquelle est
 * laquelle » demande un vrai effort. Partout ailleurs, un tracé unique reste
 * sur le premier plan — une teinte n'y décrirait rien.
 *
 * Les statuts n'ont pas d'équivalent textuel : ils portent du sens que la
 * couleur seule rend, doublée du libellé pour rester lisible sans elle.
 */
export const SERIES = {
  clicks: "var(--chart-clicks)",
} as const;

/** Statuts. Réservés : aucune de ces trois teintes ne sert ailleurs. */
export const STATUS = {
  live: "var(--chart-live)",
  pending: "var(--chart-pending)",
  rejected: "var(--chart-rejected)",
} as const;

/**
 * Indices de graduations régulièrement espacés.
 *
 * Laisser Recharts choisir les positions via `interval` lui permet d'en poser
 * deux à trois pixels d'écart, et les dates se chevauchent. En donnant les
 * indices, l'espacement est garanti par construction : les extrémités sont
 * toujours incluses, donc le premier et le dernier point restent datés.
 *
 * Renvoie des indices, pas des libellés : sur un axe catégoriel, Recharts
 * compare `ticks` aux valeurs de `dataKey`. À l'appelant de les convertir.
 */
export function tickIndices(count: number, max = 6): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

/**
 * Combien de dates tiennent sur la largeur disponible.
 *
 * Le nombre doit suivre la place, pas être fixé : sur 375 px, six libellés
 * « 10 sept. » se chevauchent — et Recharts, qui écarte alors les graduations
 * trop proches, supprime la première au lieu de resolver le problème. Trois
 * dates restent le minimum lisible au téléphone.
 */
export function tickBudget(width: number): number {
  if (width <= 0) return 6;
  if (width < 420) return 3;
  if (width < 700) return 4;
  return 6;
}
