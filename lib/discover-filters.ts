import { PRODUCT_CATEGORIES } from "@/config/categories";
import { PRODUCT_TYPES } from "@/config/product-types";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { LIFECYCLE_STATUS } from "@/config/lifecycle";
import { AGE_RATINGS } from "@/config/ratings";

/**
 * Filtres de `/discover` — l'URL est l'unique source de vérité.
 *
 * Flux unidirectionnel : URL → (serveur) → props → contexte → UI.
 * Un clic de filtre fait un `router.push` ; le serveur renvoie le nouvel
 * état. Il n'existe donc pas deux états à synchroniser (la classe de
 * bug « la sidebar dit 3 filtres, la liste n'a pas bougé » est
 * structurellement impossible).
 *
 * Volontairement hors URL : `q` (la recherche). Le taper déclencherait
 * une navigation par frappe ; l'input reste donc un état local, seedé une
 * seule fois au mount depuis `?q=` (navigation depuis la navbar).
 */

/** Params d'URL par facette (multi = param répété : `?type=a&type=b`). */
export const DISCOVER_PARAMS = {
  cat: "cat",
  types: "type",
  platforms: "platform",
  pricing: "pricing",
  lifecycle: "lifecycle",
  ages: "age",
  sort: "sort",
} as const;

/** Tri — dans l'URL (le serveur trie) : `votes` par défaut, jamais vide. */
export type DiscoverSort = "votes" | "newest";

/** Taille de page (client + serveur : source unique, module client-safe). */
export const DISCOVER_PAGE_SIZE = 12;
export function parseDiscoverSort(params: ParamsReader): DiscoverSort {
  return params.get(DISCOVER_PARAMS.sort) === "newest" ? "newest" : "votes";
}

export type DiscoverFilterState = {
  cat: string | null;
  types: string[];
  platforms: string[];
  pricing: string[];
  lifecycle: string[];
  ages: string[];
};

export const EMPTY_DISCOVER_FILTERS: DiscoverFilterState = {
  cat: null,
  types: [],
  platforms: [],
  pricing: [],
  lifecycle: [],
  ages: [],
};

type ParamsReader = Pick<URLSearchParams, "get" | "getAll">;

/** Ne garde que les ids connus des config — une URL éditée à la main ne pollue pas l'état. */
function keepValid(values: string[], validIds: readonly string[]): string[] {
  const allowed = new Set(validIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (allowed.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Pur, testé seul : URL → état de filtres. */
export function parseDiscoverFilters(params: ParamsReader): DiscoverFilterState {
  const cat = params.get(DISCOVER_PARAMS.cat);
  return {
    cat: cat != null && PRODUCT_CATEGORIES.some((c) => c.id === cat) ? cat : null,
    types: keepValid(
      params.getAll(DISCOVER_PARAMS.types),
      PRODUCT_TYPES.map((t) => t.id),
    ),
    platforms: keepValid(
      params.getAll(DISCOVER_PARAMS.platforms),
      PLATFORMS.map((p) => p.id),
    ),
    pricing: keepValid(
      params.getAll(DISCOVER_PARAMS.pricing),
      PRICING_MODELS.map((p) => p.id),
    ),
    lifecycle: keepValid(
      params.getAll(DISCOVER_PARAMS.lifecycle),
      LIFECYCLE_STATUS.map((l) => l.id),
    ),
    ages: keepValid(
      params.getAll(DISCOVER_PARAMS.ages),
      AGE_RATINGS.map((a) => a.id),
    ),
  };
}

/** Pur, testé seul : état de filtres (+ tri + recherche) → URL. Les valeurs vides sont omises. */
export function buildDiscoverHref(
  state: Partial<DiscoverFilterState>,
  page?: number | null,
  sort?: string | null,
  q?: string | null,
): string {
  const query = new URLSearchParams();
  if (state.cat) query.set(DISCOVER_PARAMS.cat, state.cat);
  for (const v of state.types ?? []) query.append(DISCOVER_PARAMS.types, v);
  for (const v of state.platforms ?? []) query.append(DISCOVER_PARAMS.platforms, v);
  for (const v of state.pricing ?? []) query.append(DISCOVER_PARAMS.pricing, v);
  for (const v of state.lifecycle ?? []) query.append(DISCOVER_PARAMS.lifecycle, v);
  for (const v of state.ages ?? []) query.append(DISCOVER_PARAMS.ages, v);
  if (sort != null && sort !== "" && sort !== "votes") query.set(DISCOVER_PARAMS.sort, sort);
  const trimmed = (q ?? "").trim();
  if (trimmed !== "") query.set("q", trimmed);
  if (page != null && page > 1) query.set("page", String(page));
  const s = query.toString();
  return `/discover${s !== "" ? `?${s}` : ""}`;
}

export function countActiveFilters(state: DiscoverFilterState): number {
  return (
    (state.cat ? 1 : 0) +
    state.types.length +
    state.platforms.length +
    state.pricing.length +
    state.lifecycle.length +
    state.ages.length
  );
}

export function hasActiveFilters(state: DiscoverFilterState): boolean {
  return countActiveFilters(state) > 0;
}

/** Toggle d'une facette multi dans un patch (pure). */
export function toggleInArray(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}
