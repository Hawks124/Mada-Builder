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
  const prods = await db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
  const prodEntries: MetadataRoute.Sitemap = prods.map((p) => ({
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
  const makerEntries: MetadataRoute.Sitemap = makers.map((m) => ({
    url: `${base}/makers/${m.username}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  return [...statics, ...cats, ...prodEntries, ...makerEntries];
}
