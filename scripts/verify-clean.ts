import "./_env";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { productDownloads, productScreenshots, products, users } from "@/db/schema";

/**
 * Purge les fixtures des scripts de non-régression.
 *
 * Les scripts `verify-*.ts` créent de vrais comptes et de vraies fiches
 * (le submit exige un maker réel) et les purgent à la fin — dans un
 * `finally`, donc même en cas de crash. Mais un run interrompu (Ctrl+C,
 * timeout, machine coupée) laissait les comptes factices en base : ils
 * apparaissaient dans l'admin et dans les listes de makers, et ils
 * encombraient le prod.
 *
 * Ce script nettoie ce qui reste. Il est sans danger : il ne touche
 * QUE les fixtures (domaine `example.com` réservé par la RFC 2606, et
 * les fiches de test). Le nom des fixtures est celui des scripts
 * (`verify-*`).
 *
 * Usage : `npm run verify:clean`
 */

const FIXTURE_EMAIL_SUFFIX = "%@example.com";

async function main() {
  // 1. Les fiches de test (slug `verify-*`) : captures, téléchargements,
  //    votes et commentaires d'abord (les FK sont en cascade côté
  //    produit, mais on reste explicite), puis la fiche.
  const fixtureProducts = await db
    .select({ id: products.id, slug: products.slug })
    .from(products)
    .where(ilike(products.slug, "verify-%"));
  for (const p of fixtureProducts) {
    await db.delete(productScreenshots).where(eq(productScreenshots.productId, p.id));
    await db.delete(productDownloads).where(eq(productDownloads.productId, p.id));
  }
  const deletedProducts = await db
    .delete(products)
    .where(ilike(products.slug, "verify-%"))
    .returning({ slug: products.slug });

  // 2. Les comptes de test (domaine réservé `example.com`).
  const deletedUsers = await db
    .delete(users)
    .where(
      and(
        or(ilike(users.email, FIXTURE_EMAIL_SUFFIX), ilike(users.username, "verify-%")),
        isNull(users.deletedAt),
      ),
    )
    .returning({ email: users.email });

  console.log(
    `verify:clean — ${deletedProducts.length} fiche(s) et ${deletedUsers.length} compte(s) de test purgés.`,
  );
  if (deletedUsers.length > 0) {
    console.log("  comptes :", deletedUsers.map((u) => u.email).join(", "));
  }
  if (deletedProducts.length > 0) {
    console.log("  fiches  :", deletedProducts.map((p) => p.slug).join(", "));
  }
  // 3. Un compte de test qui traîne avec un soft-delete (donc invisible
  //    au filtre admin, mais présent en base) : on le retire aussi.
  const softDeleted = await db
    .delete(users)
    .where(
      and(
        or(ilike(users.email, FIXTURE_EMAIL_SUFFIX), ilike(users.username, "verify-%")),
        sql`${users.deletedAt} is not null`,
      ),
    )
    .returning({ email: users.email });
  if (softDeleted.length > 0) {
    console.log(`  (+ ${softDeleted.length} compte(s) déjà soft-deleted, retirés)`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("verify:clean — échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
