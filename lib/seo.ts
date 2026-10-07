import { siteUrl } from "@/lib/site-url";

/** ItemList schema.org pour les pages de listes (rich results éligibles). */
export function itemListLd(
  items: { slug: string; name: string }[],
  listName: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl()}/products/${it.slug}`,
      name: it.name,
    })),
  };
}
