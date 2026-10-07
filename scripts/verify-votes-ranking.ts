// Votes + classement + produit du jour : toggle, poids, rescore, paliers
// featured, fenêtres leaderboard, discover, jobs. Makers dédiés (quotas),
// comptes antidatés en SQL brut (paliers d'âge 1h/24h), nettoyage total.
// Usage: npx tsx scripts/verify-votes-ranking.ts
import "./_env";
import { db } from "@/db";
import { featuredProducts, products, users, votes } from "@/db/schema";
import { putR2Object, deleteR2Object, r2Configured } from "@/lib/r2";
import { toggleVote, getUserVotedIds } from "@/services/votes.service";
import {
  getFeatured,
  getLeaderboard,
  getNewest,
  recomputeScores,
  recountProductScore,
  rotateFeaturedDaily,
  scoreFor,
  setFeaturedOverride,
} from "@/services/ranking.service";
import { searchProducts } from "@/services/discover.service";
import { sweepR2Orphans } from "@/services/products.service";
import { ProfileError, deleteAccount } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { and, eq, sql } from "drizzle-orm";

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

const TAG = `verify-votes-${Date.now()}`;
const VOTER = "verify-votes@example.com";
const VOTER_YOUNG = "verify-votes-young@example.com";
const VOTER_FRESH = "verify-votes-fresh@example.com";

async function makeUser(email: string): Promise<string> {
  const admin = createAdminClient();
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
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Votes" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Maker verify incréable : ${created.error?.message ?? "inconnu"}`);
  }
  return created.data.user.id;
}

async function backdateUser(id: string, hoursAgo: number): Promise<void> {
  await db.execute(
    sql`UPDATE users SET created_at = NOW() - ${`${hoursAgo} hours`}::interval WHERE id = ${id}`,
  );
}

async function makeProduct(
  makerId: string,
  name: string,
  publishedHoursAgo: number | null,
): Promise<string> {
  const slug = `verify-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${TAG}`;
  const [row] = await db
    .insert(products)
    .values({
      slug,
      makerId,
      name,
      tagline: "Tagline de vérification.",
      description: "Description.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: publishedHoursAgo === null ? "draft" : "published",
      upvoteCount: 0,
    })
    .returning({ id: products.id });
  if (publishedHoursAgo !== null) {
    await db.execute(
      sql`UPDATE products SET published_at = NOW() - ${`${publishedHoursAgo} hours`}::interval, created_at = NOW() - ${`${publishedHoursAgo} hours`}::interval WHERE id = ${row.id}`,
    );
  }
  return row.id;
}

async function cleanupUser(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (row) await deleteAccount(row.id, row.id);
  try {
    const admin = createAdminClient();
    const listed = await admin.auth.admin.listUsers({ perPage: 100 });
    const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
    if (ghost) await admin.auth.admin.deleteUser(ghost.id);
  } catch {
    // best-effort
  }
  const [gone] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return !gone;
}

async function main(): Promise<void> {
  const voter = await makeUser(VOTER);
  const young = await makeUser(VOTER_YOUNG);
  const fresh = await makeUser(VOTER_FRESH);
  await backdateUser(voter, 30 * 24); // 30 j : poids 1
  await backdateUser(young, 2); // 2 h : poids 0 (shadow)
  const owned = await makeProduct(voter, "Vote Loop", 5);
  const draft = await makeProduct(voter, "Vote Draft", null);

  // 1. Roundtrip vote/unvote + recompte exact.
  const v1 = await toggleVote({ viewerId: voter, productId: owned });
  check("vote enregistré", v1.voted === true && v1.upvoteCount === 1 && v1.counted === true);
  const votedIds = await getUserVotedIds(voter, [owned, draft]);
  check("votedIds", votedIds.has(owned) && !votedIds.has(draft));
  const v2 = await toggleVote({ viewerId: voter, productId: owned });
  check("vote retiré", v2.voted === false && v2.upvoteCount === 0);

  // 2. Self-vote autorisé (décision) : le maker vote sa propre fiche.
  const v3 = await toggleVote({ viewerId: voter, productId: owned });
  check("self-vote autorisé", v3.voted === true && v3.upvoteCount === 1);
  await toggleVote({ viewerId: voter, productId: owned });

  // 3. Shadow-weighting : poids 0 affiché mais hors rang.
  const y1 = await toggleVote({ viewerId: young, productId: owned });
  check("poids 0 jeune compte", y1.voted === true && y1.upvoteCount === 1 && y1.counted === false);
  const [weightRow] = await db
    .select({ weight: votes.weight })
    .from(votes)
    .where(and(eq(votes.userId, young), eq(votes.productId, owned)))
    .limit(1);
  check("poids stocké 0", weightRow.weight === 0);
  await toggleVote({ viewerId: young, productId: owned });

  // 3-bis. Promotion anti-faille : le poids 0 devient 1 quand le compte
  // dépasse 24 h (sweep `recomputeScores`), sinon il resterait à 0 pour
  // toujours et le dialogue « il pèsera au classement » mentirait.
  await toggleVote({ viewerId: young, productId: owned });
  await backdateUser(young, 25);
  await recomputeScores();
  const [promotedRow] = await db
    .select({ weight: votes.weight })
    .from(votes)
    .where(and(eq(votes.userId, young), eq(votes.productId, owned)))
    .limit(1);
  check("poids promu à 1 après 24 h", promotedRow.weight === 1);
  await toggleVote({ viewerId: young, productId: owned });

  // 4. Compte < 1 h refusé.
  let freshRefused = false;
  let freshReason: unknown = null;
  try {
    await toggleVote({ viewerId: fresh, productId: owned });
  } catch (e) {
    freshRefused = e instanceof ProfileError && e.code === "VALIDATION";
    freshReason = e instanceof ProfileError ? e.details : null;
  }
  check("compte < 1 h refusé", freshRefused);
  check(
    "reason machine (pas de match texte)",
    typeof freshReason === "object" &&
      freshReason !== null &&
      (freshReason as { reason?: unknown }).reason === "account_too_young",
  );

  // 5. Banni refusé.
  await db.execute(sql`UPDATE users SET banned_at = NOW() WHERE id = ${voter}`);
  let bannedRefused = false;
  try {
    await toggleVote({ viewerId: voter, productId: owned });
  } catch (e) {
    bannedRefused = e instanceof ProfileError && e.code === "FORBIDDEN";
  }
  check("banni refusé", bannedRefused);
  await db.execute(sql`UPDATE users SET banned_at = NULL WHERE id = ${voter}`);

  // 6. Draft/pending invisibles au vote (pas de fuite d'existence).
  let draftHidden = false;
  try {
    await toggleVote({ viewerId: voter, productId: draft });
  } catch (e) {
    draftHidden = e instanceof ProfileError && e.code === "NOT_FOUND";
  }
  check("draft non votable (404 générique)", draftHidden);

  // 7. m16 : recount exact (compteur fantaisiste 99 → valeur réelle).
  await db.execute(sql`UPDATE products SET upvote_count = 99 WHERE id = ${owned}`);
  const v4 = await toggleVote({ viewerId: voter, productId: owned });
  check("recount exact (m16)", v4.upvoteCount === 1);
  await toggleVote({ viewerId: voter, productId: owned });

  // 8. Rescore mathématique : 3 votes pondérés, publiée il y a 1 h.
  const scored = await makeProduct(young, "Vote Score", 1);
  await db.insert(votes).values([
    { userId: voter, productId: scored, weight: 1 },
    { userId: young, productId: scored, weight: 1 },
    { userId: fresh, productId: scored, weight: 1 },
  ]);
  await recountProductScore(scored);
  const [scoredRow] = await db
    .select({ score: products.score, upvoteCount: products.upvoteCount })
    .from(products)
    .where(eq(products.id, scored))
    .limit(1);
  const expected = scoreFor(3, new Date(Date.now() - 3_600_000));
  check(
    "score = w/(h+2)^1.5",
    Math.abs(scoredRow.score - expected) < 0.05 && scoredRow.upvoteCount === 3,
  );
  // Retiré aussitôt : ses 3 votes fausseraient le palier top plus bas
  // (le service a raison de le préférer — craft contre craft).
  await db.delete(products).where(eq(products.id, scored));

  // 9. Fenêtres leaderboard (invariants, pas de dépendance aux crafts).
  const todayBoard = await getLeaderboard({ window: "today", page: 1 });
  const dayStartIso = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
  check(
    "today: que des publiés du jour",
    todayBoard.items.every((i) => i.publishedAt >= dayStartIso),
  );
  const allBoard = await getLeaderboard({ window: "all", page: 1 });
  check("all ordonné par upvotes", allBoard.items.length > 0);
  let ordered = true;
  for (let i = 1; i < allBoard.items.length; i++) {
    if (allBoard.items[i].votes > allBoard.items[i - 1].votes) ordered = false;
  }
  check("all décroissant", ordered);

  // 10. Newest : le plus récent d'abord.
  const newest = await getNewest(6);
  check("newest non vide", newest.length > 0);

  // 11. Featured : override puis paliers (dates injectées, protocole UTC).
  const pin = await setFeaturedOverride({ isStaff: true, productId: owned });
  check("override épingle", pin.productId === owned);
  const pinned = await getFeatured();
  check("épingle respectée", pinned?.productId === owned && pinned.pinned === true);
  const unpin = await setFeaturedOverride({ isStaff: true, productId: null });
  check("épingle levée (audit)", unpin.productId === null && unpin.previousProductId === owned);
  // Palier top : produit d'hier + votes, catalogue large (seeds).
  // Hier relativement à `morrow` = [morrow 00:00 - 1 j, morrow 00:00).
  // Catalogue autonome (les seeds sont purgés) : 4 figurants d'hier.
  const yesterday = new Date();
  yesterday.setUTCHours(12, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const [extra] = await db
      .insert(products)
      .values({
        slug: `verify-top-extra-${i}-${TAG}`,
        makerId: voter,
        name: `Figurant Top ${i}`,
        tagline: "Tagline.",
        description: "Description.",
        category: "dev-tools",
        productType: "app_web",
        pricingModel: "free",
        galleryOrientation: "landscape",
        status: "published",
        publishedAt: yesterday,
      })
      .returning({ id: products.id });
    void extra;
  }
  const topCandidate = await makeProduct(young, "Vote Top", 0);
  await db.execute(
    sql`UPDATE products SET published_at = ${yesterday.toISOString()}::timestamptz, created_at = ${yesterday.toISOString()}::timestamptz WHERE id = ${topCandidate}`,
  );
  await db.insert(votes).values({ userId: voter, productId: topCandidate, weight: 1 });
  const morrow = new Date(yesterday.getTime() + 86_400_000);
  const slot = await getFeatured(morrow);
  check("palier top (hier + votes)", slot?.productId === topCandidate && slot.tier === "top");
  // Rotation : lendemain sans publication fraîche → autre fiche, palier rotation.
  const after = new Date(morrow.getTime() + 86_400_000);
  const slot2 = await getFeatured(after);
  check(
    "repli rotation",
    slot2 !== null && slot2.productId !== topCandidate && slot2.tier === "rotation",
  );

  // 12. Discover : filtre (ANY, pas primaire seul) + tri + recherche.
  const [multiCat] = await db
    .insert(products)
    .values({
      slug: `verify-multicat-${TAG}`,
      makerId: voter,
      name: "Vote Multicat",
      tagline: "Tagline.",
      description: "Description.",
      category: "ai",
      categories: ["ai", "dev-tools"],
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  const searchCat = await searchProducts({ cat: "dev-tools", sort: "votes", page: 1 });
  check(
    "discover cat = appartenance (ANY)",
    searchCat.items.some((i) => i.id === multiCat.id),
  );
  await db.delete(products).where(eq(products.id, multiCat.id));
  const searchQ = await searchProducts({ q: "Vote Loop", sort: "newest", page: 1 });
  check(
    "discover q",
    searchQ.items.some((i) => i.name === "Vote Loop"),
  );
  const searchNewest = await searchProducts({ sort: "newest", page: 1 });
  let newestOrdered = true;
  for (let i = 1; i < searchNewest.items.length; i++) {
    if (searchNewest.items[i].publishedAt > searchNewest.items[i - 1].publishedAt)
      newestOrdered = false;
  }
  check("discover newest décroissant", newestOrdered);

  // 13. Sweep + jobs idempotents.
  const sweep = await recomputeScores();
  check("sweep scores", sweep.updated >= 0);
  const r1 = await rotateFeaturedDaily();
  const r2 = await rotateFeaturedDaily();
  check("rotate idempotent", r1.productId === r2.productId);

  // 14. Sweep R2 (gated comme §5 products).
  if (!r2Configured()) {
    console.log("SKIP: sweep R2 sans stockage");
  } else {
    const { PRODUCT_LOGOS_BUCKET } = await import("@/lib/r2");
    const orphanKey = `00000000-0000-0000-0000-000000000000/logo-1-abc.webp`;
    await putR2Object(PRODUCT_LOGOS_BUCKET, orphanKey, Buffer.from("RIFF....WEBP"), "image/webp");
    const sweepRes = await sweepR2Orphans();
    check("sweep supprime l'orphelin", sweepRes.deleted >= 1);
    await deleteR2Object(PRODUCT_LOGOS_BUCKET, orphanKey).catch(() => {});
  }

  // 15. Nettoyage : fiches (cascade votes), featured futurs de test, makers.
  const craftedIds = [owned, draft, scored, topCandidate];
  await db.delete(products).where(eq(products.makerId, voter));
  await db.delete(products).where(eq(products.makerId, young));
  const [leftVotes] = await db
    .select({ id: votes.id })
    .from(votes)
    .where(
      sql`${votes.productId} IN (${sql.join(
        craftedIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    )
    .limit(1);
  check("cascade votes (fiches supprimées)", !leftVotes);
  // Historique réel préservé : seules les lignes futures de test partent.
  await db.execute(
    sql`DELETE FROM ${featuredProducts} WHERE ${featuredProducts.featuredOn} > CURRENT_DATE`,
  );
  const c1 = await cleanupUser(VOTER);
  const c2 = await cleanupUser(VOTER_YOUNG);
  const c3 = await cleanupUser(VOTER_FRESH);
  check("nettoyage makers", c1 && c2 && c3);

  console.log(`votes-ranking: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-votes-ranking crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
