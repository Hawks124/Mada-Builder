import "./_env";
import { db } from "@/db";
import { notifications, products, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/services/users.service";
import {
  getNotifications,
  markNotificationsRead,
  notify,
  notifyProductMaker,
  purgeNotifications,
  sendWeeklyDigest,
} from "@/services/notifications.service";

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

const TAG = `verify-notifs-${Date.now()}`;
const EMAIL = "verify-notifs@example.com";
const EMAIL_2 = "verify-notifs-2@example.com";

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
    user_metadata: { display_name: "Vérif Notifs" },
  });
  if (created.error || !created.data.user) throw new Error("Maker incréable");
  return created.data.user.id;
}

async function main(): Promise<void> {
  const maker = await makeUser(EMAIL);
  const other = await makeUser(EMAIL_2);
  const [prod] = await db
    .insert(products)
    .values({
      slug: `verify-notifs-${TAG}`,
      makerId: maker,
      name: "Produit Vérif Notifs",
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

  // 1. Émission directe tous kinds (jamais de throw).
  const kinds = [
    "product_approved",
    "product_rejected",
    "review_received",
    "comment_received",
    "vote_milestone",
    "appeal_decided",
  ] as const;
  for (const kind of kinds) {
    const ok = await notify({ userId: maker, kind, title: `Test ${kind}`, productId: prod.id });
    check(`émission ${kind}`, ok === true);
  }

  // 2. Unicité milestone (même seuil 2× → 1 ligne).
  await notify({
    userId: maker,
    kind: "vote_milestone",
    title: "X a dépassé 10 votes",
    productId: prod.id,
  });
  await notify({
    userId: maker,
    kind: "vote_milestone",
    title: "X a dépassé 10 votes",
    productId: prod.id,
  });
  const [{ value: mileCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, maker),
        eq(notifications.kind, "vote_milestone"),
        eq(notifications.title, "X a dépassé 10 votes"),
      ),
    );
  check("milestone idempotent", mileCount === 1);
  // Décisions identiques = 2 lignes (multi-événements légitimes).
  await notify({ userId: maker, kind: "product_approved", title: " doublon", productId: prod.id });
  await notify({ userId: maker, kind: "product_approved", title: " doublon", productId: prod.id });
  const [{ value: dupCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, maker),
        eq(notifications.kind, "product_approved"),
        eq(notifications.title, " doublon"),
      ),
    );
  check("décisions non dédupliquées", dupCount === 2);

  // 3. notifyProductMaker (résolution + pas à soi).
  const toMaker = await notifyProductMaker(prod.id, "product_approved", "Approuvé", other);
  check("vers le maker", toMaker === true);
  const toSelf = await notifyProductMaker(prod.id, "product_approved", "Auto", maker);
  check("pas à soi (acteur = maker)", toSelf === true);
  const [{ value: selfCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, maker), eq(notifications.title, "Auto")));
  check("auto-notif ignorée", selfCount === 0);

  // 4. Lecture keyset + unread + marquage.
  const page1 = await getNotifications(maker, { limit: 5 });
  check(
    "page keyset",
    page1.items.length === 5 && page1.nextCursor !== null && page1.unreadCount >= 5,
  );
  const { encodeKeysetCursor, decodeKeysetCursor } = await import("@/lib/api/pagination");
  const page2 = await getNotifications(maker, {
    limit: 20,
    cursor: decodeKeysetCursor(encodeKeysetCursor(page1.nextCursor)),
  });
  const ids1 = new Set(page1.items.map((i) => i.id));
  check(
    "page 2 sans doublon",
    page2.items.every((i) => !ids1.has(i.id)),
  );
  const marked = await markNotificationsRead(maker);
  check("tout-lu", marked.updated >= 5);
  const after = await getNotifications(maker, { limit: 5 });
  check("unread à zéro", after.unreadCount === 0);

  // 5. RLS own-row via Data API (anon ne voit rien).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/rest/v1/notifications?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const body = (await res.json().catch(() => [])) as unknown[];
  check("RLS anon fermé", res.ok && body.length === 0);

  // 6. Digest dry-run (forme, sans envoyer).
  const digest = await sendWeeklyDigest({ dryRun: true });
  check("digest dry-run", digest.eligible >= 0 && digest.sent === 0);

  // 7. Purge (lue antidatée → purgée, non-lue gardée).
  const [old] = await db
    .insert(notifications)
    .values({
      userId: maker,
      kind: "product_approved",
      title: "vieille",
      readAt: new Date("2020-01-01T00:00:00Z"),
    })
    .returning({ id: notifications.id });
  const purged = await purgeNotifications();
  const [gone] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.id, old.id))
    .limit(1);
  check("purge 90 j", purged.purged >= 1 && !gone);

  // Cleanup.
  await db.delete(products).where(eq(products.id, prod.id));
  const admin = createAdminClient();
  for (const uid of [maker, other]) {
    await deleteAccount(uid, uid);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
  console.log(`notifications: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-notifications crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
