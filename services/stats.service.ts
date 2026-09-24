import { and, count, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { users } from "@/db/schema";

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

async function countSince(
  days: number,
  onlyPath?: string,
): Promise<number> {
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
export async function getBannedCount(): Promise<number> {  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(isNull(users.deletedAt), isNotNull(users.bannedAt)));
  return value;
}
