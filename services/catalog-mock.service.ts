import { PRODUCT_CATEGORIES } from "@/config/categories";
import { PRODUCT_TYPES } from "@/config/product-types";
import { PLATFORMS, PLATFORMS_BY_TYPE } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { AGE_RATINGS, getRatingById } from "@/config/ratings";
import { CATALOG_DESCRIPTIONS } from "@/services/catalog-descriptions.mock";

/**
 * Catalogue de démonstration — une seule source pour discover, les pages
 * catégorie et le classement.
 *
 * Pourquoi il existe : la pagination, le tri et les pages `/categories/[slug]`
 * ne sont concevables qu'avec un jeu de données plus grand qu'une page.
 * Backend : cette fonction est remplacée par un `SELECT products` + `WHERE`
 * sur les mêmes colonnes (PRD §8) ; la forme de `CatalogProduct` est le
 * contrat, les appelants n'ont pas à changer.
 *
 * Génération 100 % déterministe (aucun aléatoire) : le rendu est stable
 * entre deux chargements, donc pas d'hydratation qui diverge.
 */

export type CatalogProduct = {
  id: string;
  name: string;
  tagline: string;
  categoryId: string;
  productType: string;
  /** Id de tranche d'âge (config) — distinct du badge affiché. */
  ageRating: string;
  /** Badge d'âge affiché (dérivé de `ageRating`, plus de doublon 4+/4+). */
  classification: string;
  maker: string;
  makerAvatar: string;
  votes: number;
  dailyVotes: number;
  comments: number;
  iconGradient: string;
  initials: string;
  pricing: string;
  rating: string;
  /** Ids de plateformes (config) — l'icône est résolue côté affichage. */
  platforms: string[];
  lifecycle: string;
  /** MRR vérifié en centimes. Absent = pas de badge MRR (jamais de faux chiffre). */
  mrrCents?: number;
  /** Description longue (markdown). Absente = la fiche n'a pas encore de texte. */
  description?: string;
};

const NAME_A = [
  "Trosa",
  "Kanto",
  "Mora",
  "Baoly",
  "Teny",
  "Vato",
  "Zaza",
  "Rivo",
  "Hatra",
  "Sari",
  "Vola",
  "Fihary",
  "Mofo",
  "Tsara",
  "Vaovao",
  "Hajia",
  "Ravina",
  "Tojo",
  "Bako",
  "Gasy",
];

const NAME_B = [
  "Pay",
  "Track",
  "Loop",
  "Note",
  "Shop",
  "Scan",
  "Fit",
  "Link",
  "Book",
  "Map",
  "Care",
  "Board",
  "Fox",
  "Wave",
  "Nest",
  "Desk",
  "Core",
  "Hub",
  "Kit",
  "Deck",
];

const TAGLINES = [
  "L'outil qui remplace vos trois tableurs.",
  "Un seul écran pour tout votre travail quotidien.",
  "Pensé pour les petites équipes, sans configuration.",
  "Vos données, sur votre téléphone, hors connexion.",
  "Automatise la partie pénible de votre métier.",
  "Simple à installer, complet une fois configuré.",
  "Fait à Madagascar, pour les usages d'ici.",
  "La version courte, sans le jargon.",
  "Open source, hébergé chez vous si vous voulez.",
  "Un tableau de bord, zéro feuille de calcul.",
  "Pour ceux qui en ont marre des fichiers joints.",
  "Suit vos métriques sans configuration serveur.",
  "Le quotidien de votre boutique, au même endroit.",
  "Pensé mobile d'abord, utilisable sur grand écran.",
];

const MAKERS = [
  "Kaliana R.",
  "Bryl Lim",
  "Rado Andrian",
  "Naina Rakoto",
  "Tiana Voa",
  "Sarah Jen",
  "Kevin A.",
  "Arvin",
  "Edison Modesto",
  "Tee Jay",
  "Hanta R.",
  "Miora K.",
];

const GRADIENTS = [
  "from-rose-400 to-red-500",
  "from-amber-400 to-orange-500",
  "from-teal-400 to-green-500",
  "from-sky-400 to-blue-500",
  "from-violet-500 to-fuchsia-500",
  "from-indigo-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-zinc-700 to-zinc-900",
];

function buildCatalog(): CatalogProduct[] {
  const items: CatalogProduct[] = [];

  PRODUCT_CATEGORIES.forEach((category, ci) => {
    // 2 produits par catégorie : chaque `/categories/[slug]` est ainsi
    // démontrable, et le total dépasse largement une page de grille.
    for (let k = 0; k < 2; k++) {
      const i = ci * 2 + k;
      const type = PRODUCT_TYPES[i % PRODUCT_TYPES.length]!;
      const pricing = PRICING_MODELS[i % PRICING_MODELS.length]!;
      const age = AGE_RATINGS[i % AGE_RATINGS.length]!;
      const lifecycle = i % 9 === 0 ? "dev" : i % 6 === 0 ? "beta" : "live";

      // Plateformes : suggestions du type (config) complétées si besoin.
      const suggested = PLATFORMS_BY_TYPE[type.id] ?? [];
      const platforms: string[] = [];
      for (const id of [
        ...suggested,
        ...PLATFORMS.map((p) => p.id),
        ...PLATFORMS.map((p) => p.id),
      ]) {
        if (platforms.length >= (i % 3) + 1) break;
        if (!platforms.includes(id)) platforms.push(id);
      }

      const a = NAME_A[i % NAME_A.length]!;
      const id = `p${i + 1}`;
      // Le second nom est décalé par le groupe de 20 : sans ce `+ ⌊i/20⌋`,
      // `7 × 20 ≡ 0 (mod 20)` faisait que `i` et `i+20` produisaient le même
      // couple — donc 8 noms distincts pour 70 produits, et le classement
      // `/revenue` affichait le même produit 3 fois à 3 rangs différents.
      const b = NAME_B[(i * 7 + Math.floor(i / NAME_A.length)) % NAME_B.length]!;
      const recurring = pricing.id === "subscription" || pricing.id === "freemium";

      items.push({
        id,
        name: `${a} ${b}`,
        tagline: TAGLINES[i % TAGLINES.length]!,
        categoryId: category.id,
        productType: type.id,
        ageRating: age.id,
        classification: getRatingById(age.id).badge,
        maker: MAKERS[i % MAKERS.length]!,
        makerAvatar: `https://i.pravatar.cc/150?u=m${(i % MAKERS.length) + 1}`,
        votes: 900 - i * 11,
        dailyVotes: (i * 7) % 24,
        comments: (i * 5) % 30,
        iconGradient: GRADIENTS[i % GRADIENTS.length]!,
        initials: `${a[0]}${b[0]}`,
        pricing: pricing.id,
        rating: (4 + (i % 10) / 10).toFixed(1),
        platforms,
        lifecycle,
        // Le tri « Revenus MRR » n'a de sens que pour l'abonnement ; les
        // autres produits n'affichent donc aucun badge (pas de valeur fausse).
        //
        // Montants : de ~$60 (6 000 centimes) à ~$2 000 selon l'index. Un
        // classement qui démarrerait à 45 000 $ nuirait à la feature qu'il est
        // censé prouver — la crédibilité vient de l'ordre de grandeur local,
        // pas du nombre.
        ...(recurring ? { mrrCents: 6_000 + i * 5_900 } : {}),
        // Description longue : présente pour quelques produits seulement.
        // `...(x ? {…} : {})` plutôt que `x ?? undefined` pour ne pas sérialiser
        // une clé `description: undefined` inutile sur les 690 autres fiches.
        ...(CATALOG_DESCRIPTIONS[id] ? { description: CATALOG_DESCRIPTIONS[id] } : {}),
      });
    }
  });

  // Tri initial : le catalogue est déjà une liste "les + votés".
  return items.sort((a, b) => b.votes - a.votes);
}

let cached: CatalogProduct[] | null = null;

/** Catalogue mémoïsé (construit une fois par process serveur). */
export function getCatalog(): CatalogProduct[] {
  cached ??= buildCatalog();
  return cached;
}

/**
 * Fiche produit par id — `null` si absent.
 *
 * Le catalogue étant un mock, un `find` est suffisant ; le jour où il
 * devient un `SELECT … WHERE id = $1`, seule cette fonction change et les
 * appelants ignorent la différence.
 */
export function getProductById(id: string): CatalogProduct | null {
  return getCatalog().find((p) => p.id === id) ?? null;
}

export type CatalogSortId = "votes" | "comments" | "newest" | "revenue";

/** Tri d'affichage — même game de tri que les onglets du classement. */
export function sortCatalog(items: CatalogProduct[], sort: CatalogSortId): CatalogProduct[] {
  const out = [...items];
  switch (sort) {
    case "comments":
      return out.sort((a, b) => b.comments - a.comments);
    case "newest":
      // Proximité : pas de date de publication dans le jeu de démo, donc
      // on priorise ce qui n'est pas encore « live », puis les votes.
      return out.sort(
        (a, b) =>
          (a.lifecycle === "live" ? 1 : 0) - (b.lifecycle === "live" ? 1 : 0) || b.votes - a.votes,
      );
    case "revenue":
      return out.sort((a, b) => (b.mrrCents ?? -1) - (a.mrrCents ?? -1) || b.votes - a.votes);
    case "votes":
    default:
      return out.sort((a, b) => b.votes - a.votes);
  }
}

/** Facettes appliquées (ET logique, comme le WHERE SQL). */
export function filterCatalog(
  items: CatalogProduct[],
  facets: {
    cat: string | null;
    types: string[];
    platforms: string[];
    pricing: string[];
    lifecycle: string[];
    ages: string[];
  },
  query: string,
): CatalogProduct[] {
  const q = query.trim().toLowerCase();
  return items.filter((p) => {
    if (facets.cat != null && p.categoryId !== facets.cat) return false;
    if (facets.types.length > 0 && !facets.types.includes(p.productType)) return false;
    if (facets.platforms.length > 0 && !facets.platforms.some((id) => p.platforms.includes(id)))
      return false;
    if (facets.pricing.length > 0 && !facets.pricing.includes(p.pricing)) return false;
    if (facets.ages.length > 0 && !facets.ages.includes(p.ageRating)) return false;
    if (facets.lifecycle.length > 0 && !facets.lifecycle.includes(p.lifecycle)) return false;
    if (q !== "") {
      const hit =
        p.name.toLowerCase().includes(q) ||
        p.maker.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
}
