import {
  UserIcon,
  SmileyIcon,
  StudentIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Classification d'âge — source unique, prête pour le back-end.
 * `badge` = texte affiché dans l'encadré façon store (4+, 12+...).
 * `short` = libellé compact pour les index et chips (« 4+ · 4+ » est
 * illisible quand deux tranches partagent le même badge — d'où `short`).
 * `label` = libellé FR complet.
 * Le champ `is_child_directed` (PRD §8) et la compliance kids
 * se branchent sur l'id `kids`.
 */
export type AgeRating = {
  id: string;
  label: string;
  /** Libellé court (index, chips, facettes). */
  short: string;
  /** Placeholder prototype, comme `categories.count` (backend : count(*)). */
  count: number;
  badge: string;
  description: string;
  icon: Icon;
};

export const AGE_RATINGS: AgeRating[] = [
  {
    id: "all",
    label: "Grand public (Tous âges)",
    short: "Tous âges",
    count: 148,
    badge: "4+",
    description: "Convient à tous les âges.",
    icon: UserIcon,
  },
  {
    id: "kids",
    label: "Enfants / -13 ans",
    short: "Enfants",
    count: 19,
    badge: "4+",
    description: "Nécessite une politique de confidentialité claire (store compliance).",
    icon: SmileyIcon,
  },
  {
    id: "teens",
    label: "Adolescents (+12)",
    short: "Adolescents",
    count: 42,
    badge: "12+",
    description: "Contenu adapté aux adolescents et plus.",
    icon: StudentIcon,
  },
  {
    id: "mature",
    label: "Jeunes Adultes (+16)",
    short: "Jeunes Adultes",
    count: 51,
    badge: "16+",
    description: "Contenu adapté aux jeunes adultes et plus.",
    icon: UserCircleIcon,
  },
  {
    id: "adults",
    label: "Adultes (+18)",
    short: "Adultes",
    count: 62,
    badge: "18+",
    description: "Réservé aux adultes.",
    icon: UsersThreeIcon,
  },
];

/** Résout un rating depuis son id, avec fallback neutre (`all`). */
export function getRatingById(id: string): AgeRating {
  return AGE_RATINGS.find((r) => r.id === id) ?? AGE_RATINGS[0];
}
