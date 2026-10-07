import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, users, votes } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { checkLimit } from "@/lib/ratelimit";
import { captureError } from "@/lib/monitoring";
import { recountProductScore } from "@/services/ranking.service";
import { checkMilestones } from "@/services/notifications.service";

/**
 * Domaine votes — boucle centrale (§11) : 1/user/produit, réversible,
 * optimiste côté UI. Anti-abus : compte < 1 h refusé, < 24 h poids 0
 * (shadow-weighting : affiché, ignoré au classement), rate-limit compte
 * (30/min) + IP large (300/min — NAT mutualisé MG, anti-burst pas
 * anti-humain), fail-open documenté. Self-vote autorisé (décision :
 * vanity-positive, 1 vote visible).
 * Compteurs par RECOMPTE (`COUNT`, jamais d'incrément) : auto-réparant,
 * signal 100 % réel (m16).
 * Perf : ~3 allers-retours séquentiels max (gardes parallélisées, agrégats
 * groupés) — la latence MG→UE domine, chaque roundtrip compte.
 */

/** Garde auteur en UNE requête (ban + âge → poids). Exportée : avis et
 * commentaires appliquent la même règle (compte < 1 h refusé). */
export async function checkVoter(userId: string): Promise<{ weight: 0 | 1 }> {
  const [row] = await db
    .select({ bannedAt: users.bannedAt, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Compte introuvable.");
  if (row.bannedAt) throw new ProfileError("FORBIDDEN", "Compte suspendu.");
  const ageMs = Date.now() - row.createdAt.getTime();
  if (ageMs < 3_600_000) {
    throw new ProfileError(
      "VALIDATION",
      "Compte trop récent pour voter — réessayez dans une heure.",
      { reason: "account_too_young" },
    );
  }
  return { weight: ageMs < 86_400_000 ? 0 : 1 };
}

async function assertVoteLimit(userId: string, ip: string | null): Promise<void> {
  try {
    // Compte + IP en parallèle (indépendants — 1 roundtrip, pas 2).
    const [mine, burst] = await Promise.all([
      checkLimit({
        namespace: "votes:toggle",
        id: userId,
        window: { window: "60 s", max: 30 },
      }),
      ip
        ? checkLimit({
            namespace: "votes:toggle:ip",
            id: ip,
            window: { window: "60 s", max: 300 },
          })
        : Promise.resolve({ allowed: true }),
    ]);
    if (!mine.allowed || !burst.allowed) {
      throw new ProfileError("FORBIDDEN", "Trop de votes. Réessayez dans une minute.");
    }
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "votes.ratelimit" });
    // Limiteur en panne : on laisse passer (fail-open documenté).
  }
}

/**
 * Toggle : vote si absent (poids selon âge), retire si présent. Retourne
 * l'état frais (l'UI optimiste se réconcilie dessus) + `counted` (poids>0 ?
 * le vote compte au classement — transparence du shadow-weighting).
 */
export async function toggleVote(input: {
  viewerId: string;
  productId: string;
  ip?: string | null;
}): Promise<{ voted: boolean; upvoteCount: number; counted: boolean }> {
  // Gardes indépendantes en parallèle : auteur (ban + âge) + limites +
  // fiche (1 roundtrip, pas 4).
  const [{ weight }, product] = await Promise.all([
    checkVoter(input.viewerId),
    (async () => {
      const [row] = await db
        .select({ id: products.id, curated: products.curated })
        .from(products)
        .where(
          and(
            eq(products.id, input.productId),
            eq(products.status, "published"),
            isNull(products.deletedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    })(),
    assertVoteLimit(input.viewerId, input.ip ?? null).then(() => null),
  ]);
  // Générique volontaire : l'existence des pending/drafts ne fuit pas.
  if (!product) throw new ProfileError("NOT_FOUND", "Produit introuvable ou non publié.");
  // Veille : hors jeu — vote explicite, jamais silencieux.
  if (product.curated) {
    throw new ProfileError("VALIDATION", "Produit en veille : votes désactivés.");
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.userId, input.viewerId), eq(votes.productId, input.productId)))
      .limit(1);
    if (existing) {
      await tx
        .delete(votes)
        .where(and(eq(votes.userId, input.viewerId), eq(votes.productId, input.productId)));
    } else {
      await tx.insert(votes).values({ userId: input.viewerId, productId: input.productId, weight });
    }
    // Recompte exact en UNE requête (COUNT + SUM groupés) : jamais de
    // dérive, seed à zéro honoré.
    const [counts] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        weighted: sql<number>`coalesce(sum(${votes.weight}), 0)::int`,
      })
      .from(votes)
      .where(eq(votes.productId, input.productId));
    await tx
      .update(products)
      .set({ upvoteCount: counts?.total ?? 0, updatedAt: new Date() })
      .where(eq(products.id, input.productId));
    return { voted: !existing, upvoteCount: counts?.total ?? 0, weighted: counts?.weighted ?? 0 };
  });

  // Rescore immédiat (même formule que le sweep 15 min — pas d'attente cron).
  await recountProductScore(input.productId).catch((e) => {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "votes.rescore" });
  });
  // Milestones (best-effort, jamais bloquant — `notify` ne throw pas).
  if (result.voted) {
    await checkMilestones(input.productId).catch(() => {});
  }
  return {
    voted: result.voted,
    upvoteCount: result.upvoteCount,
    counted: result.voted ? weight > 0 : false,
  };
}

/** Votes de l'auteur sur une liste (1 requête — badges initiaux, jamais N+1). */
export async function getUserVotedIds(
  viewerId: string | null,
  productIds: string[],
): Promise<Set<string>> {
  if (!viewerId || productIds.length === 0) return new Set();
  const rows = await db
    .select({ productId: votes.productId })
    .from(votes)
    .where(and(eq(votes.userId, viewerId), inArray(votes.productId, productIds)));
  return new Set(rows.map((r) => r.productId));
}
