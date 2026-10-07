import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Robots (4B) : tout le public indexable, zéro route privée ou utilitaire.
 * `/search` : noindex (résultats redondants avec /discover).
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/settings", "/admin", "/api/", "/search"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
