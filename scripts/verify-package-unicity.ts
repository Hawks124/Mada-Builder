/**
 * Vérif T3 — invariant « un package = un produit vivant » à
 * l'approbation (`reviewBuild`).
 *
 * Scénarios réels contre la base (fixtures dédiées `verify-t3-*`,
 * nettoyage total en sortie — pas de `sql.begin` rollback possible ici :
 * le service vit sur le pool Drizzle, une autre connexion) :
 * 1. approbation du premier build d'un package → passe ;
 * 2. le MÊME package approuvé sur un AUTRE produit vivant → 422
 *    `VALIDATION` (message FR exact), le pending reste intact ;
 * 3. le produit détenteur est soft-supprimé → l'approbation du même
 *    package repasse (seuls les produits VIVANTS comptent) ;
 * 4. version bump sur le MÊME produit (même package) → passe (la
 *    contrainte est cross-produit, jamais intra-produit) ;
 * 5. le rejet n'a rien perdu : motif requis au rejet, motif persisté ;
 * 6. package null : hors de la contrainte — approbation passe.
 *
 * Écriture prod : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-package-unicity.ts`
 */
import "./_env";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { productBuilds, products, users } from "@/db/schema";
import { reviewBuild } from "@/services/builds.service";
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

/** Refus attendu : { ok: false } si rien ne refuse ; { ok, code, message } sinon. */
async function refuse(fn: () => Promise<unknown>): Promise<{
  ok: boolean;
  code?: string;
  message?: string;
  status?: number;
}> {
  try {
    await fn();
    return { ok: false };
  } catch (e) {
    if (e instanceof ProfileError) {
      return { ok: e.code === "VALIDATION", code: e.code, message: e.message, status: e.status };
    }
    return { ok: false, message: String(e) };
  }
}

const STAFF = "00000000-0000-0000-0000-0000000000e1"; // staff factice (journal reviewed_by)
const SUFFIX = Date.now().toString(36);
const PKG = `com.verify.t3.${SUFFIX}`; // unique par run (pas d'empoisonnement croisé)

async function main(): Promise<void> {
  if (process.env.VERIFY_ALLOW_PROD !== "1") {
    console.error(
      "  Base de production possible. Relance avec VERIFY_ALLOW_PROD=1 si c'est intentionnel.",
    );
    process.exit(1);
  }

  const maker = uuidv7();
  await db.insert(users).values({
    id: maker,
    username: `gr_t3_${SUFFIX}`,
    displayName: `Gr T3 ${SUFFIX}`,
    email: `gr_t3_${SUFFIX}@probe.local`,
  });

  const p1 = uuidv7(); // détenteur du package. Même fixture produit que 0062.
  await db.insert(products).values({
    id: p1,
    slug: `gr_t3_p1_${SUFFIX}`,
    makerId: maker,
    name: "Probe T3 P1",
    tagline: "détenteur initial",
    description: "produit détenteur du package",
    category: "dev-tools",
    status: "published",
  });
  const p2 = uuidv7(); // aspirant au même package
  await db.insert(products).values({
    id: p2,
    slug: `gr_t3_p2_${SUFFIX}`,
    makerId: maker,
    name: "Probe T3 P2",
    tagline: "aspirant",
    description: "produit aspirant au même package",
    category: "dev-tools",
    status: "published",
  });

  const b1 = uuidv7(); // p1, package PKG, vc 1
  await db.insert(productBuilds).values({
    id: b1,
    productId: p1,
    r2Key: `builds/${maker}/${p1}/t3-b1-${SUFFIX}.apk`,
    sha256File: "aa".repeat(32),
    sizeBytes: 12_345,
    status: "pending",
    versionCode: 1,
    package: PKG,
  });
  const b2 = uuidv7(); // p2, MÊME package, vc 1
  await db.insert(productBuilds).values({
    id: b2,
    productId: p2,
    r2Key: `builds/${maker}/${p2}/t3-b2-${SUFFIX}.apk`,
    sha256File: "bb".repeat(32),
    sizeBytes: 23_456,
    status: "pending",
    versionCode: 1,
    package: PKG,
  });

  try {
    // 1. Premier détenteur : l'approbation passe (aucun contra).
    await reviewBuild({ buildId: b1, decision: "approved", staffId: STAFF });
    const [r1] = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.id, b1))
      .limit(1);
    check("approbation du premier détenteur passe", r1?.status === "approved", r1);

    // 2. Même package, AUTRE produit vivant : refus + message FR exact,
    //    et le pending aspirant reste intact (jamais transa à moitié).
    const refus = await refuse(() =>
      reviewBuild({ buildId: b2, decision: "approved", staffId: STAFF }),
    );
    check(
      "second détenteur vivant refusé (code + message FR exact)",
      refus.ok &&
        refus.code === "VALIDATION" &&
        refus.message === "Un build de ce package est déjà approuvé sur un autre produit vivant.",
      refus,
    );
    const [r2] = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.id, b2))
      .limit(1);
    check("le pending refusé reste pending (aucun résidu)", r2?.status === "pending", r2);

    // 3. Le détenteur disparaît du monde vivant : l'approbation repasse.
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, p1));
    await reviewBuild({ buildId: b2, decision: "approved", staffId: STAFF });
    const [r3] = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.id, b2))
      .limit(1);
    check("produit détenteur soft-supprimé → l'approbation repasse", r3?.status === "approved", r3);

    // 4. Version bump sur le MÊME produit (même package) : toujours légal
    //    (la contrainte est cross-produit, jamais intra-produit).
    const b3 = uuidv7();
    await db.insert(productBuilds).values({
      id: b3,
      productId: p2,
      r2Key: `builds/${maker}/${p2}/t3-b3-${SUFFIX}.apk`,
      sha256File: "cc".repeat(32),
      sizeBytes: 34_567,
      status: "pending",
      versionCode: 2,
      package: PKG,
    });
    await reviewBuild({ buildId: b3, decision: "approved", staffId: STAFF });
    const [r4] = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.id, b3))
      .limit(1);
    check("version bump même produit (même package) passe", r4?.status === "approved", r4);

    // 5. Le rejet n'a rien perdu : motif requis, motif persisté.
    const noReason = await refuse(() =>
      reviewBuild({ buildId: b3, decision: "rejected", reason: "  ", staffId: STAFF }),
    );
    check(
      "rejet d'un build déjà tranché → « Build déjà tranché. »",
      noReason.ok && noReason.message === "Build déjà tranché.",
      noReason,
    );
    const b4 = uuidv7();
    await db.insert(productBuilds).values({
      id: b4,
      productId: p2,
      r2Key: `builds/${maker}/${p2}/t3-b4-${SUFFIX}.apk`,
      sha256File: "dd".repeat(32),
      sizeBytes: 45_678,
      status: "pending",
      versionCode: 3,
      package: PKG,
    });
    const motifKo = await refuse(() =>
      reviewBuild({ buildId: b4, decision: "rejected", reason: "  ", staffId: STAFF }),
    );
    check(
      "rejet sans motif → « Motif requis (emailé au maker). »",
      motifKo.ok && motifKo.message === "Motif requis (emailé au maker).",
      motifKo,
    );
    await reviewBuild({
      buildId: b4,
      decision: "rejected",
      reason: "binaire non inspecté (probe T3).",
      staffId: STAFF,
    });
    const [r5] = await db
      .select({ status: productBuilds.status, rejectionReason: productBuilds.rejectionReason })
      .from(productBuilds)
      .where(eq(productBuilds.id, b4))
      .limit(1);
    check(
      "rejet avec motif : rejeté + motif persisté",
      r5?.status === "rejected" && r5.rejectionReason === "binaire non inspecté (probe T3).",
      r5,
    );

    // 6. package null : hors de la contrainte — l'approbation passe même
    //    alors que PKG est déjà approuvé sur p2.
    const b5 = uuidv7();
    await db.insert(productBuilds).values({
      id: b5,
      productId: p2,
      r2Key: `builds/${maker}/${p2}/t3-b5-${SUFFIX}.apk`,
      sha256File: "ee".repeat(32),
      sizeBytes: 56_789,
      status: "pending",
      versionCode: 4,
      package: null,
    });
    await reviewBuild({ buildId: b5, decision: "approved", staffId: STAFF });
    const [r6] = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.id, b5))
      .limit(1);
    check("package null : hors contrainte, approbation passe", r6?.status === "approved", r6);
  } finally {
    // Cleanup total : builds des deux produits, produits, utilisateur.
    for (const pid of [p1, p2]) {
      await db.delete(productBuilds).where(eq(productBuilds.productId, pid));
      await db.delete(products).where(eq(products.id, pid));
    }
    await db.delete(users).where(eq(users.id, maker));
  }

  console.log(`\n${pass} ok, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Verif abortée :", e);
  process.exit(1);
});
