import { and, desc, eq, exists, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, users, votes } from "@/db/schema";

/**
 * Annuaire makers (API v1 + hero mobile) : jamais l'email, jamais le
 * motif ; bannis/supprimés exclus partout. Deux tris, un seul contrat :
 * - `recent` : makers avec ≥1 produit publié, inscription récente ;
 * - `trending` : votes pondérés reçus sur 30 j (même somme que le
 *   classement), mois glissant — pas de mois calendaire (un 1er du mois
 *   ne doit pas remettre les compteurs à zéro).
 */

export type MakerStripItem = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** `trending` seul : votes pondérés reçus (30 j). */
  score?: number;
};

/** Makers avec ≥1 produit publié (ni bannis, ni supprimés). */
function publishingMakers() {
  return and(
    isNull(users.deletedAt),
    isNull(users.bannedAt),
    exists(
      db
        .select({ one: sql`1` })
        .from(products)
        .where(
          and(
            eq(products.makerId, users.id),
            eq(products.status, "published"),
            isNull(products.deletedAt),
          ),
        ),
    ),
  );
}

export async function countPublishingMakers(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(publishingMakers());
  return row?.n ?? 0;
}

export async function listRecentMakers(limit: number): Promise<MakerStripItem[]> {
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(publishingMakers())
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit);
  return rows;
}

const TRENDING_DAYS = 30;

export async function listTrendingMakers(
  limit: number,
): Promise<{ items: MakerStripItem[]; total: number }> {
  const since = new Date(Date.now() - TRENDING_DAYS * 86_400_000);
  const score = sql<number>`sum(${votes.weight})::int`;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      score,
    })
    .from(votes)
    .innerJoin(products, eq(products.id, votes.productId))
    .innerJoin(users, eq(users.id, products.makerId))
    .where(
      and(
        gte(votes.createdAt, since),
        eq(products.status, "published"),
        isNull(products.deletedAt),
        isNull(users.deletedAt),
        isNull(users.bannedAt),
      ),
    )
    .groupBy(users.id, users.username, users.displayName, users.avatarUrl)
    .orderBy(desc(score), desc(users.id))
    .limit(limit);
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(
    db
      .select({ maker: products.makerId })
      .from(votes)
      .innerJoin(products, eq(products.id, votes.productId))
      .innerJoin(users, eq(users.id, products.makerId))
      .where(
        and(
          gte(votes.createdAt, since),
          eq(products.status, "published"),
          isNull(products.deletedAt),
          isNull(users.deletedAt),
          isNull(users.bannedAt),
        ),
      )
      .groupBy(products.makerId)
      .as("t"),
  );
  return { items: rows, total: total?.n ?? 0 };
}
