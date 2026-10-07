"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { captureError } from "@/lib/monitoring";
import { ProfileError } from "@/services/users.service";
import {
  addComment,
  deleteOwnComment,
  deleteOwnReview,
  respondToReview,
  toggleCommentVote,
  upsertReview,
} from "@/services/feedback.service";
import { logAdminAction } from "@/services/admin-audit.service";
import { requireStaffId } from "@/app/actions/admin";

export type FeedbackActionState = { ok: boolean; message: string | null };

async function viewerId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new ProfileError("FORBIDDEN", "Connectez-vous pour participer.");
  return user.id;
}

function fail(e: unknown, op: string, fallback: string): FeedbackActionState {
  if (e instanceof ProfileError) return { ok: false, message: e.message };
  captureError(e instanceof Error ? e : new Error(String(e)), { op });
  return { ok: false, message: fallback };
}

/** Créer ou modifier MON avis (note + texte, 1/user/produit). */
export async function submitReviewAction(input: {
  productId: string;
  slug: string;
  rating: number;
  body: string;
}): Promise<FeedbackActionState> {
  try {
    const id = await viewerId();
    await upsertReview({
      viewerId: id,
      productId: input.productId,
      rating: input.rating,
      body: input.body,
    });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Avis publié." };
  } catch (e) {
    return fail(e, "feedback.review", "Avis impossible pour le moment.");
  }
}

/** Supprimer MON avis. */
export async function deleteReviewAction(input: {
  productId: string;
  slug: string;
  reviewId: string;
}): Promise<FeedbackActionState> {
  try {
    const id = await viewerId();
    await deleteOwnReview({ viewerId: id, reviewId: input.reviewId });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Avis supprimé." };
  } catch (e) {
    return fail(e, "feedback.review.delete", "Suppression impossible.");
  }
}

/** Réponse maker (unique, officielle). */
export async function respondReviewAction(input: {
  productId: string;
  slug: string;
  reviewId: string;
  body: string;
}): Promise<FeedbackActionState> {
  try {
    const id = await viewerId();
    await respondToReview({ viewerId: id, reviewId: input.reviewId, body: input.body });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Réponse publiée." };
  } catch (e) {
    return fail(e, "feedback.respond", "Réponse impossible.");
  }
}

/** Commenter ou répondre (1 niveau). */
export async function submitCommentAction(input: {
  productId: string;
  slug: string;
  body: string;
  parentId?: string | null;
}): Promise<FeedbackActionState> {
  try {
    const id = await viewerId();
    await addComment({
      viewerId: id,
      productId: input.productId,
      body: input.body,
      parentId: input.parentId ?? null,
    });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Commentaire publié." };
  } catch (e) {
    return fail(e, "feedback.comment", "Commentaire impossible pour le moment.");
  }
}

/** Supprimer MON commentaire. */
export async function deleteCommentAction(input: {
  productId: string;
  slug: string;
  commentId: string;
}): Promise<FeedbackActionState> {
  try {
    const id = await viewerId();
    await deleteOwnComment({ viewerId: id, commentId: input.commentId });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Commentaire supprimé." };
  } catch (e) {
    return fail(e, "feedback.comment.delete", "Suppression impossible.");
  }
}

/** Voter +1/-1 sur un commentaire (toggle). */
export async function voteCommentAction(input: {
  productId: string;
  slug: string;
  commentId: string;
  value: "up" | "down";
}): Promise<FeedbackActionState & { voted?: "up" | "down" | null; score?: number }> {
  try {
    const id = await viewerId();
    const res = await toggleCommentVote({
      viewerId: id,
      commentId: input.commentId,
      value: input.value,
    });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: null, ...res };
  } catch (e) {
    return fail(e, "feedback.comment.vote", "Vote impossible.");
  }
}

/** Modération staff (avis ou commentaire) + audit. */
export async function moderateFeedbackAction(input: {
  kind: "review" | "comment";
  id: string;
  slug: string;
  reason: string;
}): Promise<FeedbackActionState> {
  try {
    const { id: actorId } = await requireStaffId();
    const reason = input.reason.trim();
    if (reason === "") return { ok: false, message: "Motif requis." };
    const { deleteReviewAsStaff, deleteCommentAsStaff } =
      await import("@/services/feedback.service");
    const { productId } =
      input.kind === "review"
        ? await deleteReviewAsStaff({ isStaff: true, reviewId: input.id })
        : await deleteCommentAsStaff({ isStaff: true, commentId: input.id });
    await logAdminAction({
      actorId,
      targetId: productId,
      action: input.kind === "review" ? "review_removed" : "comment_removed",
      note: reason,
    });
    revalidatePath(`/products/${input.slug}`);
    return { ok: true, message: "Contenu retiré." };
  } catch (e) {
    return fail(e, "feedback.moderate", "Modération impossible.");
  }
}
