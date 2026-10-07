import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { PRODUCT_CATEGORIES } from "@/config/categories";
import { siteUrl } from "@/lib/site-url";

/**
 * Sitemap dynamique (4B) : produits publiés, catégories config, makers
 * avec ≥1 produit publié, pages statiques. Zéro route privée (dashboard,
 * admin, auth, api, search) — voir `app/robots.ts`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/discover`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/leaderboard`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/revenue`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/regles`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/conditions`, changeFrequency: "monthly", priority: 0.3 },
  ];
  const cats: MetadataRoute.Sitemap = PRODUCT_CATEGORIES.map((c) => ({
    url: `${base}/categories/${c.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  // CI/build sans clés (fail-open documenté) : statiques + catégories
  // sans DB ; les entrées DB s'ajoutent quand le backend répond.
  // Jamais de throw au prerender (sinon `next build` casse sans secrets).
  let prodEntries: MetadataRoute.Sitemap = [];
  let makerEntries: MetadataRoute.Sitemap = [];
  try {
    const prods = await db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
    prodEntries = prods.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    }));
    const makers = await db
      .selectDistinct({ username: users.username })
      .from(users)
      .innerJoin(products, eq(products.makerId, users.id))
      .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
    makerEntries = makers.map((m) => ({
      url: `${base}/makers/${m.username}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    // Sans backend : sitemap partiel (statiques + catégories).
  }
  return [...statics, ...cats, ...prodEntries, ...makerEntries];
}
