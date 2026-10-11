import { DiscoverClient } from "@/components/discover/discover-client";
import { parseDiscoverFilters, parseDiscoverSort } from "@/lib/discover-filters";
import { getSessionUser } from "@/lib/supabase/server";
import { getUserVotedIds } from "@/services/votes.service";
import { searchProducts } from "@/services/discover.service";
import { itemListLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

type SearchParams = Record<string, string | string[] | undefined>;

// SEO : canonical de base (les facettes partagent le jus) ; recherche
// textuelle = noindex/follow (résultats redondants, comme /search).
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const base: Metadata = {
    title: "Découvrir les produits tech malgaches | Mada-Made",
    description:
      "Explorez l'annuaire des produits tech construits à Madagascar : filtrez par catégorie, plateforme et prix, et soutenez les makers.",
    alternates: { canonical: `${siteUrl()}/discover` },
  };
  if (q !== "") return { ...base, robots: { index: false, follow: true } };
  return base;
}

// Toujours dynamique : résultats vivants (même raison que la home).
export const dynamic = "force-dynamic";

/**
 * `/discover` — serveur : l'URL est lue ici (filtres + tri + recherche +
 * page) et les items sont chargés DB. Le client navigue au clic/frappe
 * (debounced) ; aucun état dupliqué.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // searchParams → URLSearchParams (params répétés pour les facettes multi).
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (typeof value === "string") params.set(key, value);
  }
  const filters = parseDiscoverFilters(params);
  const sort = parseDiscoverSort(params);
  const query = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const [result, catalog, sessionUser] = await Promise.all([
    searchProducts({
      cat: filters.cat,
      types: filters.types,
      platforms: filters.platforms,
      pricing: filters.pricing,
      lifecycle: filters.lifecycle,
      ages: filters.ages,
      q: query,
      sort,
      page,
    }),
    searchProducts({}),
    getSessionUser(),
  ]);
  const votedIds = await getUserVotedIds(
    sessionUser?.id ?? null,
    result.items.map((i) => i.id),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListLd(result.items, "Découvrir les produits tech malgaches")),
        }}
      />
      <DiscoverClient
        initialFilters={filters}
        initialSortId={sort}
        initialQuery={query}
        initialPage={page}
        items={result.items}
        total={result.total}
        catalogTotal={catalog.total}
        votedIds={[...votedIds]}
      />
    </>
  );
}
