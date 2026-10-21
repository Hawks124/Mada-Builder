import { and, count, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { users } from "@/db/schema";
import { getMakersCount } from "@/services/users.service";
import { countPublishedByCategory } from "@/services/catalog-counts.service";
import { getEmailStats } from "@/services/emails.service";
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

/**
 * Les 4 compteurs `page_views` en UNE requête (FILTER aggregates) :
 * 4 round-trips → 1. L'overview lançait 16+ requêtes concurrentes sur
 * un pool à 10 slots — le mur des files d'attente (8 s + timeout)
 * venait du fan-out, pas des tables. Même chiffres, même fenêtres.
 */
export async function getPageViewStats(): Promise<{
  v7: number;
  v30: number;
  total: number;
  home7: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      v7: sql<number>`count(*) filter (where ${pageViews.createdAt} >= ${daysAgo(7).toISOString()}::timestamptz)::int`,
      v30: sql<number>`count(*) filter (where ${pageViews.createdAt} >= ${daysAgo(30).toISOString()}::timestamptz)::int`,
      home7: sql<number>`count(*) filter (where ${pageViews.createdAt} >= ${daysAgo(7).toISOString()}::timestamptz and ${pageViews.path} = '/')::int`,
    })
    .from(pageViews);
  return { v7: row?.v7 ?? 0, v30: row?.v30 ?? 0, total: row?.total ?? 0, home7: row?.home7 ?? 0 };
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
 *
 * **Pas de `.catch` ici** (contre-intuitif, volontaire) : transformer une
 * erreur de lecture en `0` produit un « file vide » affirmative — le badge
 * disparaît et l'admin croit que personne n'a rien soumis. La rejection
 * remonte jusqu'à l'appelant, qui sait l'afficher en « inconnu » (pastille
 * « — » côté shell, bouton sans chiffre côté overview, les deux l-catching
 * déjà). Zéro reste un zéro : il vient de la base, pas d'un repli.
 */
export const getPendingCountCached = cache((): Promise<number> => getProductsCount("pending"));

/** File rejetés mémoïsée par requête (badge nav, même pattern — même règle). */
export const getRejectedCountCached = cache((): Promise<number> => getProductsCount("rejected"));

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
/**
 * Compteur par catégorie pour le hero — TOUTES les catégories d'un produit
 * (pas seulement la principale).
 *
 * Même règle que les compteurs de `/categories` et que le listing des
 * pages de catégorie (qui listent les produits dont le tableau
 * `categories` CONTIENT le slug) : le compteur annonce ce que la page
 * montre. Delegue à la même fonction que `/categories` (une seule
 * implémentation, pas de divergence).
 */
export async function getPublishedCountByCategory(): Promise<Map<string, number>> {
  return countPublishedByCategory();
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

// ── Analytics admin à cache court (perf overview) ────────────────────
// Split décisionnel vs analytique : ce que l'admin ACTIONNE (files)
// reste frais avec timeout ; les compteurs vitrine sont cachés 90 s
// (personne ne modère sur un total de visites à la minute près).

export type EmailCounters = { sent: number; delivered: number; failed: number };
export type AdminAnalytics = {
  visits: number;
  visits30: number;
  visitsTotal: number;
  homeViews: number;
  makers: number;
  users: number;
  banned: number;
  published: number;
  drafts: number;
  rejected: number;
  upvotes: number;
  views: number;
  views7: number;
  clicks: number;
  clicks7: number;
  downloads: number;
  emails: EmailCounters;
  emails7: EmailCounters;
  feedback: { reviews: number; comments: number; avgRating: number | null };
};

const ANALYTICS_TTL_MS = 90_000;
let analyticsCache: { at: number; data: AdminAnalytics } | null = null;

/** Timeout individuel : une stat lente ne bloque jamais la page (repli). */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    t = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}

/** Une stat analytique : repliée si erreur/timeout, avec flag. Un repli
    à zéro affiché comme un fait produit des impossibles (total < 7 j) —
    l'appelant ne doit JAMAIS mettre en cache un lot contenant un repli. */
function stat<T>(label: string, p: Promise<T>, fallback: T): Promise<{ v: T; ok: boolean }> {
  void label;
  return new Promise<{ v: T; ok: boolean }>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ v: fallback, ok: false });
    }, 8000);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ v, ok: true });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ v: fallback, ok: false });
      },
    );
  });
}

/**
 * Téléchargements APK cumulés (plateforme). Lit le compteur dénormalisé
 * `products.download_count` — un SUM au lieu d'un COUNT sur la table
 * d'événements : l'agrégat plateforme n'a pas besoin de l'historique, et le
 * compteur se répare par le job.
 */
export async function getTotalDownloads(): Promise<number> {
  const [{ downloads }] = await db
    .select({ downloads: sql<number>`coalesce(sum(${products.downloadCount}), 0)::int` })
    .from(products)
    .where(isNull(products.deletedAt));
  return downloads;
}

const ZERO_EMAILS: EmailCounters = { sent: 0, delivered: 0, failed: 0 };

async function computeAdminAnalytics(): Promise<{ data: AdminAnalytics; ok: boolean }> {
  const [
    pageViewStats,
    makers,
    users,
    banned,
    byStatus,
    upvotes,
    views,
    views7,
    clicks,
    clicks7,
    downloads,
    emails,
    emails7,
    feedback,
  ] = await Promise.all([
    stat("pageViews", getPageViewStats(), { v7: 0, v30: 0, total: 0, home7: 0 }),
    stat("makers", getMakersCount(), 0),
    stat("users", getUsersTotal(), 0),
    stat("banned", getBannedCount(), 0),
    stat("byStatus", getProductsCountByStatus(), {
      draft: 0,
      pending: 0,
      published: 0,
      rejected: 0,
    }),
    stat("upvotes", getTotalUpvotes(), 0),
    stat("views", getProductViewsTotal(), 0),
    stat("views7", getProductViewsTotal(7), 0),
    stat("clicks", getOutboundClicksTotal(), 0),
    stat("clicks7", getOutboundClicksTotal(7), 0),
    stat("downloads", getTotalDownloads(), 0),
    stat("emails", getEmailStats(), ZERO_EMAILS),
    stat("emails7", getEmailStats(7), ZERO_EMAILS),
    stat("feedback", getFeedbackStats(), { reviews: 0, comments: 0, avgRating: null }),
  ]);
  const parts = [
    pageViewStats,
    makers,
    users,
    banned,
    byStatus,
    upvotes,
    views,
    views7,
    clicks,
    clicks7,
    downloads,
    emails,
    emails7,
    feedback,
  ];
  const ok = parts.every((s) => s.ok);
  const data: AdminAnalytics = {
    visits: pageViewStats.v.v7,
    visits30: pageViewStats.v.v30,
    visitsTotal: pageViewStats.v.total,
    homeViews: pageViewStats.v.home7,
    makers: makers.v,
    users: users.v,
    banned: banned.v,
    published: byStatus.v.published,
    drafts: byStatus.v.draft,
    rejected: byStatus.v.rejected,
    upvotes: upvotes.v,
    views: views.v,
    views7: views7.v,
    clicks: clicks.v,
    clicks7: clicks7.v,
    downloads: downloads.v,
    emails: emails.v,
    emails7: emails7.v,
    feedback: feedback.v,
  };
  return { data, ok };
}

/** Analytique cachée 90 s (module singleton serveur). Échec = zéros.
    Règle anti-mensonge : un lot contenant un repli (timeout/erreur) n'est
    JAMAIS mis en cache — sinon un zéro de repli persiste 90 s et produit
    des impossibles (total < 7 j, commentaires 0 avec des avis visibles). */
export async function getAdminAnalyticsCached(): Promise<AdminAnalytics> {
  if (analyticsCache && Date.now() - analyticsCache.at < ANALYTICS_TTL_MS) {
    return analyticsCache.data;
  }
  try {
    const { data, ok } = await computeAdminAnalytics();
    if (ok) analyticsCache = { at: Date.now(), data };
    return data;
  } catch {
    return (
      analyticsCache?.data ?? {
        visits: 0,
        visits30: 0,
        visitsTotal: 0,
        homeViews: 0,
        makers: 0,
        users: 0,
        banned: 0,
        published: 0,
        drafts: 0,
        rejected: 0,
        upvotes: 0,
        views: 0,
        views7: 0,
        clicks: 0,
        clicks7: 0,
        downloads: 0,
        emails: ZERO_EMAILS,
        emails7: ZERO_EMAILS,
        feedback: { reviews: 0, comments: 0, avgRating: null },
      }
    );
  }
}
