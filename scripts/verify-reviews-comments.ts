import "./_env";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/services/users.service";
import { ProfileError } from "@/services/users.service";
import {
  addComment,
  deleteCommentAsStaff,
  deleteOwnComment,
  deleteOwnReview,
  deleteReviewAsStaff,
  getFeedbackCounts,
  getProductComments,
  getProductReviews,
  respondToReview,
  toggleCommentVote,
  upsertReview,
} from "@/services/feedback.service";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

const TAG = `verify-feedback-${Date.now()}`;
const EMAIL = "verify-feedback@example.com";
const EMAIL_2 = "verify-feedback-2@example.com";

async function makeUser(email: string): Promise<string> {
  const admin = createAdminClient();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const [stale] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (stale) await deleteAccount(stale.id, stale.id);
    try {
      const listed = await admin.auth.admin.listUsers({ perPage: 100 });
      const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
      if (ghost) await admin.auth.admin.deleteUser(ghost.id);
    } catch {
      // best-effort
    }
    const [still] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!still) break;
    if (attempt === 3) throw new Error("Purge impossible");
    await new Promise((r) => setTimeout(r, 2000));
  }
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Feedback" },
  });
  if (created.error || !created.data.user) throw new Error("Maker incréable");
  return created.data.user.id;
}

async function main(): Promise<void> {
  const author = await makeUser(EMAIL);
  const other = await makeUser(EMAIL_2);
  // Compte < 1 h : refusé (même règle que les votes) — on backdate après.
  const [prod] = await db
    .insert(products)
    .values({
      slug: `verify-feedback-${TAG}`,
      makerId: author,
      name: "Produit Vérif Feedback",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });

  let tooYoung = false;
  try {
    await upsertReview({
      viewerId: other,
      productId: prod.id,
      rating: 5,
      body: "Super produit, vraiment utile.",
    });
  } catch (e) {
    tooYoung = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("compte jeune refusé", tooYoung);
  // Backdate 2 h (comme verify-votes) : autorisé.
  await db.execute(
    sql`UPDATE users SET created_at = NOW() - INTERVAL '2 hours' WHERE id = ${author}`,
  );
  await db.execute(
    sql`UPDATE users SET created_at = NOW() - INTERVAL '2 hours' WHERE id = ${other}`,
  );

  // 1. Avis : création + unicité + moyenne + distribution.
  const r1 = await upsertReview({
    viewerId: author,
    productId: prod.id,
    rating: 5,
    body: "Excellent produit, je recommande vivement.",
  });
  check("avis créé", Boolean(r1.id) && r1.rating === 5);
  const r2 = await upsertReview({
    viewerId: author,
    productId: prod.id,
    rating: 3,
    body: "Après usage prolongé, je revois ma note.",
  });
  check("unicité (update, pas doublon)", r2.id === r1.id && r2.rating === 3);
  const otherReview = await upsertReview({
    viewerId: other,
    productId: prod.id,
    rating: 4,
    body: "Très bon outil pour le quotidien.",
  });
  const { items, distribution } = await getProductReviews(prod.id, author);
  check("2 avis listés", items.length === 2);
  check("moyenne 3.5", distribution.avg === 3.5 && distribution.count === 2);
  check(
    "distribution",
    distribution.stars[0] === 0 && distribution.stars[1] === 1 && distribution.stars[2] === 1,
  );
  check(
    "flag own",
    items.some((i) => i.own),
  );
  let badRating = false;
  try {
    await upsertReview({
      viewerId: other,
      productId: prod.id,
      rating: 6,
      body: "Note invalide mais texte assez long.",
    });
  } catch (e) {
    badRating = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("note hors 1-5 refusée", badRating);
  let shortBody = false;
  try {
    await upsertReview({ viewerId: other, productId: prod.id, rating: 4, body: "Court" });
  } catch (e) {
    shortBody = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("texte < 10 refusé", shortBody);

  // 2. Réponse maker (unique, officielle).
  await respondToReview({ viewerId: author, reviewId: r1.id, body: "Merci pour votre retour !" });
  const after = await getProductReviews(prod.id, null);
  check(
    "réponse maker affichée",
    after.items.find((i) => i.id === r1.id)?.makerResponse === "Merci pour votre retour !",
  );
  let foreignRespond = false;
  try {
    await respondToReview({ viewerId: other, reviewId: r1.id, body: "Je ne suis pas le maker." });
  } catch (e) {
    foreignRespond = e instanceof ProfileError && e.code === "FORBIDDEN";
  }
  check("réponse non-maker refusée", foreignRespond);

  // 3. Suppression auteur (soft + compteurs).
  await deleteOwnReview({ viewerId: author, reviewId: r1.id });
  const counts = await getFeedbackCounts(prod.id);
  check("compteurs après suppression", counts.ratingsCount === 1 && counts.ratingsAvg === 4);
  const listed = await getProductReviews(prod.id, null);
  check("supprimé invisible", listed.items.length === 1);

  // 4. Commentaires : ajout + reply 1 niveau + votes + suppression.
  const c1 = await addComment({
    viewerId: other,
    productId: prod.id,
    body: "Question : ça marche offline ?",
  });
  check("commentaire créé", Boolean(c1.id));
  const c2 = await addComment({
    viewerId: author,
    productId: prod.id,
    body: "Oui, totalement.",
    parentId: c1.id,
  });
  check("reply créée", Boolean(c2.id));
  let nestedRefused = false;
  try {
    await addComment({
      viewerId: other,
      productId: prod.id,
      body: "Trop profond.",
      parentId: c2.id,
    });
  } catch (e) {
    nestedRefused = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("reply de reply refusée", nestedRefused);
  const v1 = await toggleCommentVote({ viewerId: author, commentId: c1.id, value: "up" });
  check("vote up", v1.voted === "up" && v1.score === 1);
  const v2 = await toggleCommentVote({ viewerId: author, commentId: c1.id, value: "up" });
  check("toggle (retrait)", v2.voted === null && v2.score === 0);
  const v3 = await toggleCommentVote({ viewerId: author, commentId: c1.id, value: "down" });
  check("vote down", v3.voted === "down" && v3.score === -1);
  const thread = await getProductComments(prod.id, author);
  check(
    "thread 1 niveau + myVote",
    thread.length === 1 && thread[0].replies.length === 1 && thread[0].myVote === "down",
  );
  await deleteOwnComment({ viewerId: other, commentId: c1.id });
  const counts2 = await getFeedbackCounts(prod.id);
  check("compteur commentaires", counts2.commentsCount === 1);

  // 5. Modération staff.
  const staffDel = await deleteReviewAsStaff({ isStaff: true, reviewId: otherReview.id });
  check("modération staff (avis)", staffDel.productId === prod.id);
  const staffComment = await deleteCommentAsStaff({ isStaff: true, commentId: c2.id });
  check("modération staff", Boolean(staffComment.productId));
  let staffRefused = false;
  try {
    await deleteReviewAsStaff({ isStaff: false, reviewId: otherReview.id });
  } catch (e) {
    staffRefused = e instanceof ProfileError && e.code === "FORBIDDEN";
  }
  check("modération non-staff refusée", staffRefused);

  // Cleanup.
  await db.delete(products).where(eq(products.id, prod.id));
  const admin = createAdminClient();
  for (const uid of [author, other]) {
    await deleteAccount(uid, uid);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
  console.log(`feedback: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-feedback crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
