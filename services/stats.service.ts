import { and, count, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { users } from "@/db/schema";
import {
  comments,
  products,
  productLinkClicks,
  productPageViews,
  reviews,
  votes,
} from "@/db/schema";

/**
 * Stats plateforme (overview admin) — Drizzle pur, testable hors Next.
 * Visites = hits ANONYMES (aucun user_id, aucun IP — par schéma, voir
 * db/schema/page_views.ts), PAS des uniques : bots et refreshes comptent.
 * Documenté côté UI, affiné en V1.5 (analytics).
 */

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Normalise : chemin seul (sans query/hash), 200 signes max. */
export function normalizeViewPath(raw: string): string {
  const path = raw.split("?")[0]?.split("#")[0] ?? "/";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean.slice(0, 200) || "/";
}

/**
 * Log fire-and-forget (jamais d'await côté page : zéro impact TTFB ;
 * erreurs avalées — une stat ne casse jamais un rendu).
 */
export async function logPageView(rawPath: string): Promise<void> {
  try {
    await db.insert(pageViews).values({ path: normalizeViewPath(rawPath) });
  } catch {
    // Stats best-effort — silencieux par design.
  }
}

async function countSince(days: number, onlyPath?: string): Promise<number> {
  const conditions = [gte(pageViews.createdAt, daysAgo(days))];
  if (onlyPath) conditions.push(eq(pageViews.path, onlyPath));
  const [{ value }] = await db
    .select({ value: count() })
    .from(pageViews)
    .where(and(...conditions));
  return value;
}

/** Hits tous chemins (7 j par défaut) — anonymes, connectés indistingués. */
export async function getVisitsTotal(days = 7): Promise<number> {
  return countSince(days);
}

/** Hits homepage (7 j par défaut) — la stat "vitrine" demandée. */
export async function getHomepageViews(days = 7): Promise<number> {
  return countSince(days, "/");
}

/** Total comptes non supprimés (dénominateur "X sur Y" du panel). */
export async function getUsersTotal(): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(isNull(users.deletedAt));
  return value;
}

/** Makers bannis (non supprimés) — stat modération. */
export async function getBannedCount(): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(isNull(users.deletedAt), isNotNull(users.bannedAt)));
  return value;
}

export type ProductStatus = "draft" | "pending" | "published" | "rejected";

/** Produits par statut (non supprimés) — couvre toute la plateforme. */
export async function getProductsCount(status?: ProductStatus): Promise<number> {
  const conditions = [isNull(products.deletedAt)];
  if (status) conditions.push(eq(products.status, status));
  const [{ value }] = await db
    .select({ value: count() })
    .from(products)
    .where(and(...conditions));
  return value;
}

/**
 * File pending mémoïsée par requête (React cache) : le layout admin (badge
 * shell) et la page overview (bouton file) partagent UN seul appel au lieu
 * de deux — même requête, zéro roundtrip doublé.
 */
export const getPendingCountCached = cache((): Promise<number> =>
  getProductsCount("pending").catch(() => 0),
);

/** File rejetés mémoïsée par requête (badge nav, même pattern). */
export const getRejectedCountCached = cache((): Promise<number> =>
  getProductsCount("rejected").catch(() => 0),
);

/**
 * Avis + commentaires visibles (admin) : compteurs réels (soft-deleted
 * exclus) + note moyenne. Remplace les "0 / avis en Phase 5" hardcodés —
 * les avis existent depuis le lot feedback, les stats les reflètent.
 */
export async function getFeedbackStats(): Promise<{
  reviews: number;
  comments: number;
  avgRating: number | null;
}> {
  const [[r], [c]] = await Promise.all([
    db
      .select({
        n: sql<number>`count(*)::int`,
        avg: sql<number | null>`avg(${reviews.rating})::float`,
      })
      .from(reviews)
      .where(isNull(reviews.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(comments)
      .where(isNull(comments.deletedAt)),
  ]);
  return {
    reviews: r?.n ?? 0,
    comments: c?.n ?? 0,
    avgRating: r?.avg ?? null,
  };
}

/**
 * Produits par statut en UNE requête (GROUP BY) : la page admin lisait
 * 5 statuts en 5 requêtes parallèles (5 slots du pool pour un seul
 * chiffre). Moins de pression sur le pool partagé = moins de risque de
 * slots coincés (cf. `max_lifetime` dans db/index.ts).
 */
export async function getProductsCountByStatus(): Promise<Record<ProductStatus, number>> {
  const rows = await db
    .select({ status: products.status, value: sql<number>`count(*)::int` })
    .from(products)
    .where(isNull(products.deletedAt))
    .groupBy(products.status);
  const out: Record<ProductStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    rejected: 0,
  };
  for (const r of rows) {
    if (
      r.status === "draft" ||
      r.status === "pending" ||
      r.status === "published" ||
      r.status === "rejected"
    ) {
      out[r.status] = r.value;
    }
  }
  return out;
}

/** Produits publiés par slug de catégorie — hero Écosystème (1 requête,
 *  GROUP BY). Remplace les compteurs mockés en dur de la config : avec
 *  backend, on n'affiche QUE du réel (même des zéros pré-lancement). */
export async function getPublishedCountByCategory(): Promise<Map<string, number>> {
  const rows = await db
    .select({ category: products.category, value: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNull(products.deletedAt), eq(products.status, "published")))
    .groupBy(products.category);
  return new Map(rows.map((r) => [r.category, r.value]));
}

/** Upvotes totaux (tous produits, tous statuts — recompte exact live). */
export async function getTotalUpvotes(): Promise<number> {
  const [{ value }] = await db.select({ value: sql<number>`count(*)::int` }).from(votes);
  return value;
}

/** Vues fiches (total ou fenêtre glissante). */
export async function getProductViewsTotal(days?: number): Promise<number> {
  const conditions = days !== undefined ? [gte(productPageViews.createdAt, daysAgo(days))] : [];
  const [{ value }] = await db
    .select({ value: count() })
    .from(productPageViews)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return value;
}

/** Clics sortants (total ou fenêtre glissante) — le chiffre makers. */
export async function getOutboundClicksTotal(days?: number): Promise<number> {
  const conditions = days !== undefined ? [gte(productLinkClicks.createdAt, daysAgo(days))] : [];
  const [{ value }] = await db
    .select({ value: count() })
    .from(productLinkClicks)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return value;
}
