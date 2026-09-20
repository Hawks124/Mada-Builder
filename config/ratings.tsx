/**
 * Classification d'âge — source unique, prête pour le back-end.
 * `badge` = texte affiché dans le encadré façon store (4+, 12+...).
 * `label` = libellé FR affiché à côté / dans les dropdowns.
 * Le champ `is_child_directed` (PRD §8) et la compliance kids
 * se branchent sur l'id `kids`.
 */
export type AgeRating = {
  id: string;
  label: string;
  badge: string;
  description: string;
};

export const AGE_RATINGS: AgeRating[] = [
  {
    id: "all",
    label: "Grand public (Tous âges)",
    badge: "4+",
    description: "Convient à tous les âges.",
  },
  {
    id: "kids",
    label: "Enfants / -13 ans",
    badge: "4+",
    description:
      "Nécessite une politique de confidentialité claire (store compliance).",
  },
  {
    id: "teens",
    label: "Adolescents (+12)",
    badge: "12+",
    description: "Contenu adapté aux adolescents et plus.",
  },
  {
    id: "mature",
    label: "Jeunes Adultes (+16)",
    badge: "16+",
    description: "Contenu adapté aux jeunes adultes et plus.",
  },
  {
    id: "adults",
    label: "Adultes (+18)",
    badge: "18+",
    description: "Réservé aux adultes.",
  },
];

/** Résout un rating depuis son id, avec fallback neutre (`all`). */
export function getRatingById(id: string): AgeRating {
  return AGE_RATINGS.find((r) => r.id === id) ?? AGE_RATINGS[0];
}
