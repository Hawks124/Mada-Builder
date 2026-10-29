/**
 * Vérif idempotence register builds (CodeRabbit F2).
 *
 * La clé R2 est FRAÎCHE à chaque presign (lib/r2 : `{Date.now()}`-`{rand}`),
 * donc une ligne product_builds sur le r2Key reçu = le MÊME envoi déjà
 * enregistré (client qui reposte son register après un temps mort réseau).
 * `createBuild` renvoie alors ce build existant SANS toucher à quoi que ce
 * soit — avant ce fix, le retry tombait dans `stillPending` (purge de
 * l'objet EN REVUE que l'admin venait ouvrir) ou dans le 23505 (purge de
 * la clé d'un build déjà enregistré).
 *
 * Le chemin idempotent sort AVANT tout HEAD R2 : ce verify tourne sans
 * connectivité ni fixture objet (pas de requête R2 du tout).
 *
 * Le refus d'une clé RIVALE pendant un pending n'est pas repris ici : il
 * exige un APK signé sur R2 (HEAD + parse passent AVANT la garde) — la
 * règle en base est prouvée par verify-0057-one-pending-uidx.ts.
 *
 * Service-level : fixtures SQL nettoyées en finally (aucun résidu ;
 * aucune connexion auth factice — rows users insérées en direct).
 *
 * Relance : `npx tsx scripts/verify-builds-idempotent.ts`
 */
import "./_env";
import { v7 as uuidv7 } from "uuid";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, productBuilds, users } from "@/db/schema";
import { createBuild } from "@/services/builds.service";
import { ProfileError } from "@/services/users.service";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    pass += 1;
    console.log(`  ok: ${name}`);
  } else {
    fail += 1;
    console.error(`  KO: ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

async function main(): Promise<void> {
  const suffix = Date.now().toString(36);
  const makerId = uuidv7();
  let productId: string | null = null;

  try {
    await db.insert(users).values({
      id: makerId,
      username: `v57_${suffix}`,
      displayName: `v57_${suffix}`,
      email: `v57_${suffix}@probe.local`,
    });
    const [product] = await db
      .insert(products)
      .values({
        slug: `id57_${suffix}`,
        makerId,
        name: "Probe idempotence builds",
        tagline: "Tagline.",
        description: "Description assez longue pour passer la validation.",
        category: "dev-tools",
        productType: "app_web",
        pricingModel: "free",
        status: "published",
        publishedAt: new Date(),
      })
      .returning({ id: products.id });
    productId = product.id;

    // Un build EN REVUE + un build DISTRIBUÉ, clés différentes.
    const keyPending = `builds/${makerId}/${productId}/revue-${suffix}.apk`;
    const keyApproved = `builds/${makerId}/${productId}/ligne-${suffix}.apk`;
    await db.insert(productBuilds).values([
      {
        productId,
        versionCode: 41,
        sha256File: "ab".repeat(32),
        sizeBytes: 123456,
        r2Key: keyPending,
        status: "pending",
      },
      {
        productId,
        versionCode: 5,
        sha256File: "cd".repeat(32),
        sizeBytes: 654321,
        r2Key: keyApproved,
        status: "approved",
        reviewedAt: new Date(),
      },
    ]);
    const [pendingRow] = await db
      .select({ id: productBuilds.id })
      .from(productBuilds)
      .where(and(eq(productBuilds.productId, productId), eq(productBuilds.status, "pending")))
      .limit(1);
    const [approvedRow] = await db
      .select({ id: productBuilds.id })
      .from(productBuilds)
      .where(and(eq(productBuilds.productId, productId), eq(productBuilds.status, "approved")))
      .limit(1);

    // 1. Retry du register (même clé) : le build EN REVUE est renvoyé
    //    sans rien détruire — l'objet que l'admin ouvre reste là.
    const r1 = await createBuild({
      viewerId: makerId,
      productId,
      r2Key: keyPending,
      sha256: "ab".repeat(32),
      sizeBytes: 123456,
    });
    check("retry sur un build en revue = même id, binaire intact", r1.id === pendingRow?.id, r1);

    // 2. Re-citation du binaire DISTRIBUÉ : même id — /download garde son
    //    objet (l'ancien code purgeait la clé sur 23505).
    const r2 = await createBuild({
      viewerId: makerId,
      productId,
      r2Key: keyApproved,
      sha256: "cd".repeat(32),
      sizeBytes: 654321,
    });
    check("retry sur un build approuvé = même id, binaire intact", r2.id === approvedRow?.id, r2);

    // 3. Invariant : les retries ne dupliquent RIEN (2 fixtures, pas 4).
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(productBuilds)
      .where(eq(productBuilds.productId, productId));
    check("aucune ligne dupliquée par les retries (2 fixtures)", cnt?.n === 2, cnt);

    // 4. Le register reste refusé sans clé référencée (message littéral
    //    inchangé) : le R2 HEAD manque sur une clé jamais posée.
    let refused = false;
    try {
      await createBuild({
        viewerId: makerId,
        productId,
        r2Key: `builds/${makerId}/${productId}/rival-${suffix}.apk`,
        sha256: "ee".repeat(32),
        sizeBytes: 111111,
        versionCode: 6,
        whatsnew: "Nouvelle tentative avec un objet distinct.",
      });
    } catch (e) {
      refused = e instanceof ProfileError && e.code === "VALIDATION";
    }
    check("clé jamais posée = refus (aucune ligne créée)", refused);
  } finally {
    if (productId) await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, makerId));
  }

  console.log(`\nidempotence builds : ${pass} ok, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("verify-builds-idempotent crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
