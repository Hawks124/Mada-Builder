/**
 * Slug d'ancre — même règle que GitHub, sans dépendance externe.
 *
 * Isolé dans son propre module parce que `lib/legal.ts` importe `node:fs` :
 * l'importer depuis un composant d'interface (le `Prose`, qui rend les
 * `id` de titre) tirerait le runtime Node dans le bundle. Ce module n'a
 * aucune dépendance serveur, donc il est importable partout.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
