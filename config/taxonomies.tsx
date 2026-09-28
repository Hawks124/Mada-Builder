import { PRODUCT_TYPES } from "@/config/product-types";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { LIFECYCLE_STATUS } from "@/config/lifecycle";
import { AGE_RATINGS } from "@/config/ratings";

/**
 * Facettes de navigation — les taxonomies transverses de la plateforme.
 *
 * Rôle : un point d'entrée lisible vers `/discover` pré-filtré. Une
 * taxonomie = un param d'URL, PAS une page par combinatoire (sinon on
 * recrée les ~2 100 pages vides interdites par le PRD §18). Seul
 * `/categories/[slug]` est une route : les catégories sont le seul axe
 * qui mérite son propre landing page long-traîne (PRD §7).
 */
export type TaxonomyFacet = {
  id: string;
  /** Label de la rangée (colonne fixe). */
  label: string;
  /** Param d'URL utilisé sur /discover. */
  hrefParam: string;
  items: { id: string; label: string; description: string }[];
};

export const TAXONOMY_FACETS: TaxonomyFacet[] = [
  {
    id: "type",
    label: "Type de produit",
    hrefParam: "type",
    items: PRODUCT_TYPES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
    })),
  },
  {
    id: "platform",
    label: "Plateforme",
    hrefParam: "platform",
    items: PLATFORMS.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
    })),
  },
  {
    id: "pricing",
    label: "Modèle économique",
    hrefParam: "pricing",
    items: PRICING_MODELS.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
    })),
  },
  {
    id: "lifecycle",
    label: "Avancement",
    hrefParam: "lifecycle",
    items: LIFECYCLE_STATUS.map((l) => ({
      id: l.id,
      label: l.label,
      description: l.description,
    })),
  },
  {
    id: "age",
    label: "âge",
    hrefParam: "age",
    items: AGE_RATINGS.map((r) => ({
      id: r.id,
      // Le badge store (4+, 12+…) est plus court que le libellé long.
      label: r.badge,
      description: r.description,
    })),
  },
];
