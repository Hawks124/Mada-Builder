import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, commentVotes, products, reviews, users } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { checkLimit } from "@/lib/ratelimit";
import { captureError } from "@/lib/monitoring";
import { checkVoter } from "@/services/votes.service";
import { notify } from "@/services/notifications.service";

/**
 * Domaine avis + commentaires — mêmes disciplines que les votes :
 * auth requise, compte < 1 h refusé (checkVoter), rate-limits, Zod
 * serveur, compteurs par RECOMPTE en transaction (jamais d'incrément),
 * soft delete auteur, suppression staff avec audit.
 * - Avis : 1/user/produit (`UNIQUE`), note 1-5 + texte REQUIS (10-2000),
 *   modifiable ; réponse maker UNIQUE et officielle (pas de thread).
 * - Commentaires : thread 1 NIVEAU (reply de reply refusé), votes +1/-1
 *   toggle (`UNIQUE(user,comment)`), tri score puis récence.
 */

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(2000),
});

const commentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

async function requirePublishedProduct(
  productId: string,
): Promise<{ id: string; makerId: string }> {
  const [row] = await db
    .select({ id: products.id, makerId: products.makerId })
    .from(products)
    .where(
      and(eq(products.id, productId), eq(products.status, "published"), isNull(products.deletedAt)),
    )
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable ou non publié.");
  return row;
}

/** Veille : avis désactivés (commentaires ouverts, eux). */
async function assertNotCurated(productId: string): Promise<void> {
  const [row] = await db
    .select({ curated: products.curated })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (row?.curated) {
    throw new ProfileError("VALIDATION", "Produit en veille : avis désactivés.");
  }
}

async function assertFeedbackLimit(userId: string, op: string): Promise<void> {
  try {
    const { allowed } = await checkLimit({
      namespace: `feedback:${op}`,
      id: userId,
      window: { window: "60 s", max: 20 },
    });
    if (!allowed)
      throw new ProfileError("FORBIDDEN", "Trop de requêtes. Réessayez dans une minute.");
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "feedback.ratelimit" });
  }
}

// ── Avis ─────────────────────────────────────────────────────────────────

/**
 * Crée ou met à jour MON avis (1/user/produit) : insert (+rating/+1) ou
 * update (+(new-old)). Notifie le maker à la CRÉATION (jamais pour son
 * propre avis, jamais à la modification — pas de bruit).
 */
export async function upsertReview(input: {
  viewerId: string;
  productId: string;
  rating: number;
  body: string;
}): Promise<{ id: string; rating: number; created: boolean }> {
  const parsed = reviewSchema.safeParse({ rating: input.rating, body: input.body });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "rating") {
      throw new ProfileError("VALIDATION", "Note : entre 1 et 5 étoiles.");
    }
    throw new ProfileError("VALIDATION", "Avis : 10 caractères minimum (2000 max).");
  }
  await checkVoter(input.viewerId);
  const product = await requirePublishedProduct(input.productId);
  await assertNotCurated(input.productId);
  await assertFeedbackLimit(input.viewerId, "review");
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: reviews.id, rating: reviews.rating })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, input.viewerId),
          eq(reviews.productId, input.productId),
          isNull(reviews.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      const delta = parsed.data.rating - existing.rating;
      await tx
        .update(reviews)
        .set({ rating: parsed.data.rating, body: parsed.data.body, updatedAt: new Date() })
        .where(eq(reviews.id, existing.id));
      if (delta !== 0) {
        await tx
          .update(products)
          .set({ ratingsSum: sql`${products.ratingsSum} + ${delta}` })
          .where(eq(products.id, input.productId));
      }
      return { id: existing.id, rating: parsed.data.rating, created: false };
    }
    const [created] = await tx
      .insert(reviews)
      .values({
        userId: input.viewerId,
        productId: input.productId,
        rating: parsed.data.rating,
        body: parsed.data.body,
      })
      .returning({ id: reviews.id });
    await tx
      .update(products)
      .set({
        ratingsSum: sql`${products.ratingsSum} + ${parsed.data.rating}`,
        ratingsCount: sql`${products.ratingsCount} + 1`,
      })
      .where(eq(products.id, input.productId));
    return { id: created.id, rating: parsed.data.rating, created: true };
  });
  if (result.created && product.makerId !== input.viewerId) {
    const [named] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);
    await notify({
      userId: product.makerId,
      kind: "review_received",
      title: `Nouvel avis sur ${named?.name ?? "votre produit"} (${parsed.data.rating}/5)`,
      productId: input.productId,
      actorId: input.viewerId,
    });
  }
  return result;
}

/** Suppression de MON avis (soft + compteurs ajustés). */
export async function deleteOwnReview(input: {
  viewerId: string;
  reviewId: string;
}): Promise<void> {
  const [row] = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      productId: reviews.productId,
      rating: reviews.rating,
    })
    .from(reviews)
    .where(and(eq(reviews.id, input.reviewId), isNull(reviews.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Avis introuvable.");
  if (row.userId !== input.viewerId) throw new ProfileError("FORBIDDEN", "Avis d'autrui.");
  await db.transaction(async (tx) => {
    await tx.update(reviews).set({ deletedAt: new Date() }).where(eq(reviews.id, row.id));
    await tx
      .update(products)
      .set({
        ratingsSum: sql`${products.ratingsSum} - ${row.rating}`,
        ratingsCount: sql`GREATEST(${products.ratingsCount} - 1, 0)`,
      })
      .where(eq(products.id, row.productId));
  });
}

/** Réponse maker (UNIQUE, officielle) — seul le maker de la fiche. */
export async function respondToReview(input: {
  viewerId: string;
  reviewId: string;
  body: string;
}): Promise<void> {
  const text = input.body.trim();
  if (text.length < 1 || text.length > 1000) {
    throw new ProfileError("VALIDATION", "Réponse : 1 à 1000 caractères.");
  }
  const [row] = await db
    .select({ id: reviews.id, productId: reviews.productId })
    .from(reviews)
    .where(and(eq(reviews.id, input.reviewId), isNull(reviews.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Avis introuvable.");
  const product = await requirePublishedProduct(row.productId);
  if (product.makerId !== input.viewerId) {
    throw new ProfileError("FORBIDDEN", "Seul le maker peut répondre.");
  }
  await assertFeedbackLimit(input.viewerId, "respond");
  await db
    .update(reviews)
    .set({ makerResponse: text, makerRespondedAt: new Date() })
    .where(eq(reviews.id, row.id));
}

/** Suppression staff (soft + compteurs + audit par l'appelant). */
export async function deleteReviewAsStaff(input: {
  isStaff: boolean;
  reviewId: string;
}): Promise<{ productId: string }> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db
    .select({ id: reviews.id, productId: reviews.productId, rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.id, input.reviewId), isNull(reviews.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Avis introuvable.");
  await db.transaction(async (tx) => {
    await tx.update(reviews).set({ deletedAt: new Date() }).where(eq(reviews.id, row.id));
    await tx
      .update(products)
      .set({
        ratingsSum: sql`${products.ratingsSum} - ${row.rating}`,
        ratingsCount: sql`GREATEST(${products.ratingsCount} - 1, 0)`,
      })
      .where(eq(products.id, row.productId));
  });
  return { productId: row.productId };
}

export type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  own: boolean;
  makerResponse: string | null;
  makerRespondedAt: string | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
};

/** Avis d'une fiche (récence) + distribution pour le header. */
export async function getProductReviews(
  productId: string,
  viewerId: string | null,
  limit = 20,
): Promise<{
  items: ReviewItem[];
  distribution: { avg: number; count: number; stars: [number, number, number, number, number] };
}> {
  const rows = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      makerResponse: reviews.makerResponse,
      makerRespondedAt: reviews.makerRespondedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.productId, productId), isNull(reviews.deletedAt)))
    .orderBy(reviews.createdAt)
    .limit(Math.min(Math.max(limit, 1), 50));
  const stars: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of rows) {
    stars[5 - r.rating] = (stars[5 - r.rating] ?? 0) + 1;
    sum += r.rating;
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      own: viewerId !== null && r.userId === viewerId,
      makerResponse: r.makerResponse,
      makerRespondedAt: r.makerRespondedAt?.toISOString() ?? null,
      author: { username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
    })),
    distribution: {
      avg: rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : 0,
      count: rows.length,
      stars,
    },
  };
}

// ── Commentaires ─────────────────────────────────────────────────────────

/** Ajoute un commentaire ou une reply (1 niveau : parent sans parent). */
export async function addComment(input: {
  viewerId: string;
  productId: string;
  body: string;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const parsed = commentSchema.safeParse({ body: input.body });
  if (!parsed.success) throw new ProfileError("VALIDATION", "Commentaire : 1 à 1000 caractères.");
  await checkVoter(input.viewerId);
  const product = await requirePublishedProduct(input.productId);
  await assertFeedbackLimit(input.viewerId, "comment");
  let parentAuthorId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        productId: comments.productId,
        parentId: comments.parentId,
      })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), isNull(comments.deletedAt)))
      .limit(1);
    if (!parent || parent.productId !== input.productId) {
      throw new ProfileError("NOT_FOUND", "Commentaire parent introuvable.");
    }
    if (parent.parentId !== null) {
      throw new ProfileError("VALIDATION", "Un niveau de réponse uniquement.");
    }
    parentAuthorId = parent.userId;
  }
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(comments)
      .values({
        userId: input.viewerId,
        productId: input.productId,
        parentId: input.parentId ?? null,
        body: parsed.data.body,
      })
      .returning({ id: comments.id });
    await tx
      .update(products)
      .set({ commentsCount: sql`${products.commentsCount} + 1` })
      .where(eq(products.id, input.productId));
    return { id: row.id };
  });
  // Notifs : maker (sauf son propre commentaire) + auteur du parent
  // (sauf soi-même et sauf maker déjà notifié).
  const [named] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  const productName = named?.name ?? "votre produit";
  const targets = new Set<string>();
  if (product.makerId !== input.viewerId) targets.add(product.makerId);
  if (parentAuthorId && parentAuthorId !== input.viewerId && parentAuthorId !== product.makerId) {
    targets.add(parentAuthorId);
  }
  await Promise.all(
    [...targets].map((userId) =>
      notify({
        userId,
        kind: parentAuthorId && userId === parentAuthorId ? "comment_replied" : "comment_received",
        title:
          parentAuthorId && userId === parentAuthorId
            ? `Réponse à votre commentaire sur ${productName}`
            : `Nouveau commentaire sur ${productName}`,
        productId: input.productId,
        actorId: input.viewerId,
      }),
    ),
  );
  return created;
}

/** Suppression de MON commentaire (soft + compteur). */
export async function deleteOwnComment(input: {
  viewerId: string;
  commentId: string;
}): Promise<void> {
  const [row] = await db
    .select({ id: comments.id, userId: comments.userId, productId: comments.productId })
    .from(comments)
    .where(and(eq(comments.id, input.commentId), isNull(comments.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Commentaire introuvable.");
  if (row.userId !== input.viewerId) throw new ProfileError("FORBIDDEN", "Commentaire d'autrui.");
  await db.transaction(async (tx) => {
    await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, row.id));
    await tx
      .update(products)
      .set({ commentsCount: sql`GREATEST(${products.commentsCount} - 1, 0)` })
      .where(eq(products.id, row.productId));
  });
}

/** Vote +1/-1 (toggle : même valeur = retrait). Recompte exact. */
export async function toggleCommentVote(input: {
  viewerId: string;
  commentId: string;
  value: "up" | "down";
}): Promise<{ voted: "up" | "down" | null; score: number }> {
  await checkVoter(input.viewerId);
  const [row] = await db
    .select({ id: comments.id, productId: comments.productId })
    .from(comments)
    .where(and(eq(comments.id, input.commentId), isNull(comments.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Commentaire introuvable.");
  await requirePublishedProduct(row.productId);
  await assertFeedbackLimit(input.viewerId, "comment-vote");
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: commentVotes.id, value: commentVotes.value })
      .from(commentVotes)
      .where(
        and(eq(commentVotes.userId, input.viewerId), eq(commentVotes.commentId, input.commentId)),
      )
      .limit(1);
    let voted: "up" | "down" | null = input.value;
    if (existing) {
      await tx.delete(commentVotes).where(eq(commentVotes.id, existing.id));
      if (existing.value === input.value) voted = null;
      else {
        await tx
          .insert(commentVotes)
          .values({ userId: input.viewerId, commentId: input.commentId, value: input.value });
      }
    } else {
      await tx
        .insert(commentVotes)
        .values({ userId: input.viewerId, commentId: input.commentId, value: input.value });
    }
    const [counts] = await tx
      .select({
        score: sql<number>`coalesce(sum(case when ${commentVotes.value} = 'up' then 1 else -1 end), 0)::int`,
      })
      .from(commentVotes)
      .where(eq(commentVotes.commentId, input.commentId));
    const score = counts?.score ?? 0;
    await tx.update(comments).set({ score }).where(eq(comments.id, input.commentId));
    return { voted, score };
  });
}

/** Suppression staff (soft + compteur + audit par l'appelant). */
export async function deleteCommentAsStaff(input: {
  isStaff: boolean;
  commentId: string;
}): Promise<{ productId: string }> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db
    .select({ id: comments.id, productId: comments.productId })
    .from(comments)
    .where(and(eq(comments.id, input.commentId), isNull(comments.deletedAt)))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Commentaire introuvable.");
  await db.transaction(async (tx) => {
    await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, row.id));
    await tx
      .update(products)
      .set({ commentsCount: sql`GREATEST(${products.commentsCount} - 1, 0)` })
      .where(eq(products.id, row.productId));
  });
  return { productId: row.productId };
}

export type CommentItem = {
  id: string;
  body: string;
  score: number;
  createdAt: string;
  own: boolean;
  myVote: "up" | "down" | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
  replies: CommentItem[];
};

/** Thread 1 niveau : top-level (score puis récence) + replies (récence). */
export async function getProductComments(
  productId: string,
  viewerId: string | null,
  limit = 30,
): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      parentId: comments.parentId,
      body: comments.body,
      score: comments.score,
      createdAt: comments.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.productId, productId), isNull(comments.deletedAt)))
    .orderBy(comments.score, comments.createdAt)
    .limit(Math.min(Math.max(limit, 1), 100));
  let myVotes = new Map<string, "up" | "down">();
  if (viewerId && rows.length > 0) {
    const voteRows = await db
      .select({ commentId: commentVotes.commentId, value: commentVotes.value })
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.userId, viewerId),
          inArray(
            commentVotes.commentId,
            rows.map((r) => r.id),
          ),
        ),
      );
    myVotes = new Map(voteRows.map((v) => [v.commentId, v.value as "up" | "down"]));
  }
  const toItem = (r: (typeof rows)[number]): CommentItem => ({
    id: r.id,
    body: r.body,
    score: r.score,
    createdAt: r.createdAt.toISOString(),
    own: viewerId !== null && r.userId === viewerId,
    myVote: myVotes.get(r.id) ?? null,
    author: { username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
    replies: [],
  });
  const tops: CommentItem[] = [];
  const byId = new Map<string, CommentItem>();
  for (const r of rows) {
    const item = toItem(r);
    byId.set(r.id, item);
    if (!r.parentId) tops.push(item);
  }
  for (const r of rows) {
    if (r.parentId) byId.get(r.parentId)?.replies.push(byId.get(r.id)!);
  }
  // Replies : récence (l'ordre score global ne s'applique pas au thread).
  for (const t of tops) {
    t.replies.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  return tops;
}

/** Compteurs frais d'une fiche (mise à jour UI après mutation). */
export async function getFeedbackCounts(productId: string): Promise<{
  ratingsCount: number;
  ratingsAvg: number;
  commentsCount: number;
}> {
  const [row] = await db
    .select({
      ratingsSum: products.ratingsSum,
      ratingsCount: products.ratingsCount,
      commentsCount: products.commentsCount,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  return {
    ratingsCount: row.ratingsCount,
    ratingsAvg:
      row.ratingsCount > 0 ? Math.round((row.ratingsSum / row.ratingsCount) * 10) / 10 : 0,
    commentsCount: row.commentsCount,
  };
}
