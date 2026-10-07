// API hardening Phase 6 : idempotence, garde 413, curseurs, presign,
// JWT local. Hermétique (makers dédiés, nettoyage total). R2-gated pour
// le presign (PUT réel + submit) ; le reste est offline pur.
// Usage: npx tsx scripts/verify-api-hardening.ts
import "./_env";
import { SignJWT } from "jose";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { deleteR2Object, putR2Object, r2Configured } from "@/lib/r2";
import { PRODUCT_LOGOS_BUCKET, presignStagingUpload } from "@/lib/r2";
import { withIdempotency } from "@/lib/api/idempotency";
import { assertContentLength, withCache, ApiError } from "@/lib/api/response";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/lib/api/pagination";
import { requireApiUser } from "@/lib/api/auth";
import { submitProduct } from "@/services/products.service";
import { ProfileError, deleteAccount } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq } from "drizzle-orm";

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

const EMAIL = "verify-hardening@example.com";

async function makeUser(email: string): Promise<string> {
  const admin = createAdminClient();
  // Purge + VÉRIFICATION (un run crashé laisse un fantôme auth : sans ça,
  // createUser échoue avec un message cryptique). 3 tentatives, échec franc.
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
    } catch (e) {
      console.log(
        `purge auth tentative ${attempt} : ${e instanceof Error ? e.message.slice(0, 100) : e}`,
      );
    }
    const [stillPublic] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    let stillAuth = false;
    try {
      const listed = await admin.auth.admin.listUsers({ perPage: 100 });
      stillAuth = listed.data.users.some((u) => u.email?.toLowerCase() === email);
    } catch {
      // Vérification impossible : on tente la création quand même.
    }
    if (!stillPublic && !stillAuth) break;
    if (attempt === 3) {
      throw new Error(`Purge impossible (public=${Boolean(stillPublic)}, auth=${stillAuth})`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Hardening" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Maker verify incréable : ${created.error?.message ?? "inconnu"}`);
  }
  return created.data.user.id;
}

async function main(): Promise<void> {
  const maker = await makeUser(EMAIL);
  const baseData = {
    name: "Produit Vérif Hardening",
    tagline: "Tagline.",
    description: "Description assez longue pour passer la validation.",
    productType: "app_web",
    category: "dev-tools",
    platforms: ["web"],
    pricingModel: "free",
    lifecycle: "live",
    audience: "all",
    galleryOrientation: "landscape",
    links: {},
  };

  // 1. Idempotence : même clé = 1 exécution + replay identique.
  let runs = 0;
  const key = `test-${Date.now()}`;
  const first = await withIdempotency({
    userId: maker,
    key,
    run: async () => {
      runs++;
      return { status: 201, data: { id: `id-${runs}` } };
    },
  });
  const second = await withIdempotency({
    userId: maker,
    key,
    run: async () => {
      runs++;
      return { status: 201, data: { id: `id-${runs}` } };
    },
  });
  check("idempotence : 1 exécution", runs === 1);
  check(
    "idempotence : replay identique",
    second.replayed === true && (second.data as { id: string }).id === "id-1",
  );
  check("idempotence : 1er non rejoué", first.replayed === false);
  const other = await withIdempotency({
    userId: maker,
    key: `other-${Date.now()}`,
    run: async () => {
      runs++;
      return { status: 200, data: {} };
    },
  });
  check("idempotence : clé différente = exécute", other.replayed === false && runs === 2);
  const direct = await withIdempotency({
    userId: maker,
    key: null,
    run: async () => ({ status: 200, data: {} }),
  });
  check("idempotence : sans clé = direct", direct.replayed === false);
  let badKey = false;
  try {
    await withIdempotency({
      userId: maker,
      key: "mauvaise clé !",
      run: async () => ({ status: 200, data: {} }),
    });
  } catch (e) {
    badKey = e instanceof ApiError && e.code === "VALIDATION";
  }
  check("idempotence : clé invalide 422", badKey);

  // 2. Garde taille : 413 franc, absent = passe, ordure = 400.
  const big = new Request("https://x.test/", {
    headers: { "content-length": String(80 * 1024 * 1024) },
  });
  let tooBig = false;
  try {
    assertContentLength(big, 72 * 1024 * 1024);
  } catch (e) {
    tooBig = e instanceof ApiError && e.status === 413;
  }
  check("garde 413", tooBig);
  const noHeader = new Request("https://x.test/");
  let noHeaderOk = true;
  try {
    assertContentLength(noHeader, 10);
  } catch {
    noHeaderOk = false;
  }
  check("garde absente = passe", noHeaderOk);
  let garbage400 = false;
  try {
    assertContentLength(
      new Request("https://x.test/", { headers: { "content-length": "not-a-number" } }),
      10,
    );
  } catch (e) {
    garbage400 = e instanceof ApiError && e.status === 400;
  }
  check("garde ordure = 400", garbage400);

  // 3. Curseurs : roundtrip + tolérance.
  const cursor = encodeKeysetCursor({ at: "2026-01-02T03:04:05.000Z", id: "abc" });
  const decoded = decodeKeysetCursor(cursor);
  check(
    "curseur roundtrip",
    decoded !== null &&
      decoded.id === "abc" &&
      decoded.at.toISOString() === "2026-01-02T03:04:05.000Z",
  );
  check("curseur null", encodeKeysetCursor(null) === null && decodeKeysetCursor(null) === null);
  check("curseur ordure", decodeKeysetCursor("!!!") === null && decodeKeysetCursor("{}") === null);
  check(
    "cache helper",
    withCache(new Response("x"), "public, s-maxage=60").headers.get("Cache-Control") ===
      "public, s-maxage=60",
  );

  // 4. JWT local : signé maison accepté, expiré/forgé refusés (offline pur).
  const secret = `verify-secret-${Date.now()}`;
  const prevSecret = process.env.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_JWT_SECRET = secret;
  const goodToken = await new SignJWT({ sub: maker })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  const me = await requireApiUser(
    new Request("https://x.test/", { headers: { authorization: `Bearer ${goodToken}` } }),
  );
  check("JWT local accepté", me.id === maker);
  const expiredToken = await new SignJWT({ sub: maker })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("authenticated")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(new TextEncoder().encode(secret));
  let expired401 = false;
  try {
    await requireApiUser(
      new Request("https://x.test/", { headers: { authorization: `Bearer ${expiredToken}` } }),
    );
  } catch (e) {
    expired401 = e instanceof ApiError && e.status === 401;
  }
  check("JWT expiré 401", expired401);
  const forgedToken = await new SignJWT({ sub: maker })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("mauvais-secret"));
  let forged401 = false;
  try {
    await requireApiUser(
      new Request("https://x.test/", { headers: { authorization: `Bearer ${forgedToken}` } }),
    );
  } catch (e) {
    forged401 = e instanceof ApiError && e.status === 401;
  }
  check("JWT forgé 401", forged401);
  if (prevSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
  else process.env.SUPABASE_JWT_SECRET = prevSecret;

  // 5. Presign + submit stagé (R2-gated : PUT réel, download, pipeline).
  if (!r2Configured()) {
    console.log("SKIP: presign sans R2");
  } else {
    const logoBytes = await (
      await import("sharp")
    )
      .default({
        create: { width: 512, height: 512, channels: 3, background: { r: 9, g: 9, b: 9 } },
      })
      .png()
      .toBuffer();
    const shotBytes = await (
      await import("sharp")
    )
      .default({
        create: { width: 800, height: 400, channels: 3, background: { r: 9, g: 60, b: 9 } },
      })
      .png()
      .toBuffer();
    const presigned = await presignStagingUpload({
      bucket: PRODUCT_LOGOS_BUCKET,
      makerId: maker,
      contentType: "image/png",
      contentLength: logoBytes.length,
    });
    check("presign clé staging maker", presigned.key.startsWith(`staging/${maker}/`));
    const put = await fetch(presigned.url, {
      method: "PUT",
      body: logoBytes,
      headers: { "Content-Type": "image/png" },
    });
    check("PUT direct R2", put.ok);
    const { PRODUCT_SHOTS_BUCKET } = await import("@/lib/r2");
    const presignedShot = await presignStagingUpload({
      bucket: PRODUCT_SHOTS_BUCKET,
      makerId: maker,
      contentType: "image/png",
      contentLength: shotBytes.length,
    });
    const putShot = await fetch(presignedShot.url, {
      method: "PUT",
      body: shotBytes,
      headers: { "Content-Type": "image/png" },
    });
    check("PUT direct R2 (shot)", putShot.ok);
    const submitted = await submitProduct({
      viewerId: maker,
      data: { ...baseData, links: { website: "https://example.com/staged" } },
      staged: { logo: presigned.key, screenshots: [presignedShot.key] },
      asDraft: false,
    });
    check("submit stagé pending", submitted.status === "pending");
    const [submittedRow] = await db
      .select({ iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.id, submitted.id))
      .limit(1);
    check("logo final .webp", submittedRow.iconUrl?.endsWith(".webp") ?? false);
    await db.delete(products).where(eq(products.id, submitted.id));
    // Préfixe étranger refusé (clé d'un autre maker, objet réel).
    const victim = `staging/00000000-0000-0000-0000-000000000000/${Date.now()}-x.png`;
    await putR2Object(PRODUCT_LOGOS_BUCKET, victim, logoBytes, "image/png");
    let foreignRefused = false;
    try {
      await submitProduct({
        viewerId: maker,
        data: { ...baseData, name: "Produit Vérif Étranger" },
        staged: { logo: victim, screenshots: [] },
        asDraft: true,
      });
    } catch (e) {
      foreignRefused = e instanceof ProfileError && e.code === "VALIDATION";
    }
    check("staging étranger refusé", foreignRefused);
    await deleteR2Object(PRODUCT_LOGOS_BUCKET, victim).catch(() => {});
  }

  // 6. Nettoyage maker.
  const [stale] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);
  if (stale) await deleteAccount(stale.id, stale.id);
  try {
    const admin = createAdminClient();
    const listed = await admin.auth.admin.listUsers({ perPage: 100 });
    const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === EMAIL);
    if (ghost) await admin.auth.admin.deleteUser(ghost.id);
  } catch {
    // best-effort
  }
  const [gone] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);
  check("nettoyage maker", !gone);

  console.log(`api-hardening: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-api-hardening crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
