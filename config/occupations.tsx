import {
  HammerIcon,
  CodeIcon,
  PaletteIcon,
  RocketLaunchIcon,
  BriefcaseIcon,
  HardDriveIcon,
  DatabaseIcon,
  SuitcaseIcon,
  GraduationCapIcon,
  BugIcon,
  UserIcon,
  DotsThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type Occupation = {
  id: string;
  /** Libellé FR — vocabulaire fermé, SEO-friendly (users.occupation). */
  label: string;
  description: string;
  icon: Icon;
};

/** Défaut : l'identité de la plateforme. Tout inscrit y construit. */
export const DEFAULT_OCCUPATION_ID = "maker";

export const OCCUPATIONS: Occupation[] = [
  {
    id: "maker",
    label: "Maker",
    description: "Je construis des produits",
    icon: HammerIcon,
  },
  {
    id: "developer",
    label: "Développeur",
    description: "Web, mobile, backend, systèmes...",
    icon: CodeIcon,
  },
  {
    id: "designer",
    label: "Designer",
    description: "UI/UX, graphique, produit...",
    icon: PaletteIcon,
  },
  {
    id: "founder",
    label: "Fondateur",
    description: "CEO, cofondateur, hacker...",
    icon: RocketLaunchIcon,
  },
  {
    id: "product-manager",
    label: "Product Manager",
    description: "Produit, stratégie, delivery",
    icon: BriefcaseIcon,
  },
  {
    id: "devops",
    label: "DevOps / SysAdmin",
    description: "Infra, cloud, automatisation",
    icon: HardDriveIcon,
  },
  {
    id: "data",
    label: "Data",
    description: "Data science, analyse, IA",
    icon: DatabaseIcon,
  },
  {
    id: "freelance",
    label: "Freelance",
    description: "Indépendant, missions clients",
    icon: SuitcaseIcon,
  },
  {
    id: "student",
    label: "Étudiant",
    description: "En formation, en apprentissage",
    icon: GraduationCapIcon,
  },
  {
    id: "qa",
    label: "QA / Testeur",
    description: "Qualité, tests, recette",
    icon: BugIcon,
  },
  {
    id: "client",
    label: "Client / Utilisateur",
    description: "J'utilise et je soutiens",
    icon: UserIcon,
  },
  {
    id: "other",
    label: "Autre",
    description: "Tout le reste",
    icon: DotsThreeIcon,
  },
];

/** Résout une occupation depuis son id, avec fallback sur le défaut. */
export function getOccupationById(id: string): Occupation {
  return (
    OCCUPATIONS.find((o) => o.id === id) ??
    OCCUPATIONS.find((o) => o.id === DEFAULT_OCCUPATION_ID)!
  );
}
