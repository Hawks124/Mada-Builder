import { DiscoverClient } from "@/components/discover/discover-client";
import { parseDiscoverFilters } from "@/lib/discover-filters";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * `/discover` — serveur : l'URL est lue ici et transformée en état de
 * filtres (cf. lib/discover-filters). Le client ne fait que rendre et
 * navigue au clic ; il n'existe donc pas deux états à synchroniser.
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

  return (
    <DiscoverClient
      initialFilters={parseDiscoverFilters(params)}
      initialQuery={typeof sp.q === "string" ? sp.q : ""}
      initialPage={Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1)}
    />
  );
}
