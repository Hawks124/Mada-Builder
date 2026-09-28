import {
  CATEGORY_FAMILIES,
  PRODUCT_CATEGORIES,
  getFamilyCategories,
  type ProductCategory,
} from "@/config/categories";
import { PRODUCT_TYPES } from "@/config/product-types";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { LIFECYCLE_STATUS } from "@/config/lifecycle";
import { AGE_RATINGS } from "@/config/ratings";
import type { FacetGroup, FacetItem } from "@/components/categories/category-index";

/**
 * Sérialisation serveur → client pour la page catégories.
 *
 * Les configs importent leurs icônes depuis `@phosphor-icons/react/dist/ssr`
 * (module serveur-only) : impossible de passer un composant d'icône en
 * prop à un composant client. On convertit donc chaque icône en
 * `iconId` (clé de catégorie / de taxonomie) et le composant client
 * résout le composant via son registre d'icônes.
 *
 * Tout part dans le même type `FacetItem` : les domaines et les axes
 * transverses se rendent par le même composant, donc ils ne peuvent pas
 * diverger visuellement. Chaque item porte son `href` final, calculé ici
 * plutôt que dans le client.
 */

/**
 * Les configs ne sont pas homogènes sur la couleur : `PRODUCT_CATEGORIES`
 * fournit déjà un `hoverColor` préfixé `group-hover:`, alors que
 * plateformes / pricing / avancement portent un `accentClass` statique
 * appliqué en permanence. La page n'utilisant la couleur qu'au survol,
 * on re-scope ces derniers pour que les 14 blocs se comportent pareil.
 */
function hoverText(classes: string | undefined): string | undefined {
  if (!classes) return undefined;
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token.startsWith("dark:text-")) return `dark:group-hover:${token.slice(5)}`;
      if (token.startsWith("text-")) return `group-hover:${token}`;
      return token;
    })
    .join(" ");
}

function domainItem(c: ProductCategory): FacetItem {
  return {
    id: c.id,
    label: c.name,
    description: c.subtitle,
    count: c.count,
    // Préfixe `cat-` : trois ids de catégorie (`saas`, `iot`, `other`)
    // existent aussi comme type de produit.
    iconId: `cat-${c.id}`,
    href: `/categories/${c.id}`,
    hoverTextClass: c.hoverColor,
    hoverBgClass: c.hoverBg,
  };
}

/** Domaines regroupés en familles — la vue « Par domaine ». */
export function getDomainGroups(): FacetGroup[] {
  return CATEGORY_FAMILIES.map((family) => ({
    id: family.id,
    label: family.label,
    items: getFamilyCategories(family)
      .map(domainItem)
      // Tri par count décroissant : chaque colonne se lit alors de haut en
      // bas du plus gros au plus petit, sans avoir à comparer les nombres.
      .sort((a, b) => b.count - a.count),
  })).filter((f) => f.items.length > 0);
}

function facetGroup(id: string, label: string, items: FacetItem[]): FacetGroup {
  return { id, label, items };
}

function axisItem(
  item: { id: string; label: string; description: string; count: number },
  hrefParam: string,
  accentClass?: string,
): FacetItem {
  return {
    id: item.id,
    label: item.label,
    description: item.description,
    count: item.count,
    iconId: item.id,
    href: `/discover?${hrefParam}=${item.id}`,
    hoverTextClass: hoverText(accentClass),
  };
}

/** Les 5 axes transverses — la vue « Par critère ». */
export function getCriteriaGroups(): FacetGroup[] {
  return [
    facetGroup(
      "type",
      "Type de produit",
      [...PRODUCT_TYPES]
        // Trié par count décroissant : en ordre de config, la troncature
        // repliée cacherait `saas` (78 produits).
        .sort((a, b) => b.count - a.count)
        .map((t) => axisItem(t, "type")),
    ),
    facetGroup(
      "platform",
      "Plateforme",
      PLATFORMS.map((p) => axisItem(p, "platform", p.accentClass)),
    ),
    facetGroup(
      "pricing",
      "Modèle économique",
      PRICING_MODELS.map((p) => axisItem(p, "pricing", p.accentClass)),
    ),
    facetGroup(
      "lifecycle",
      "Avancement",
      LIFECYCLE_STATUS.map((l) => ({
        id: l.id,
        label: l.label,
        description: l.description,
        count: l.count,
        iconId: `lc-${l.id}`,
        href: `/discover?lifecycle=${l.id}`,
        hoverTextClass: hoverText(l.textClass),
      })),
    ),
    facetGroup(
      "age",
      "âge",
      AGE_RATINGS.map((a) => ({
        id: a.id,
        label: a.short,
        description: a.description,
        count: a.count,
        // L'axe âge n'a pas d'icône : la pastille est remplacée par un
        // AgeBadge, rendu côté client depuis `badge`.
        href: `/discover?age=${a.id}`,
        badge: a.badge,
      })),
    ),
  ];
}

/**
 * Compteurs de l'index — en-tête de `/categories` (`<CategoryStats>`).
 *
 * Attention : `grep` sur `app\**\*.tsx` **rate** `app/(site)/…`, les
 * parenthèses du nom de groupe de routes cassent le glob. Une recherche
 * « cette fonction n'est-elle utilisée que par le footer ? »doit passer par
 * `grep -r` sur l'arborescence entière, sinon elle conclut à tort que la
 * fonction est orpheline et la suppression passe en compile.
 */
export function getCategoryStats() {
  return {
    categoryCount: PRODUCT_CATEGORIES.length,
    typeCount: PRODUCT_TYPES.length,
    productCount: PRODUCT_CATEGORIES.reduce((acc, c) => acc + c.count, 0),
  };
}
