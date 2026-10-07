import "./_env";
import { db } from "@/db";
import { products, productScreenshots } from "@/db/schema";
import { PRODUCT_LOGOS_BUCKET, PRODUCT_SHOTS_BUCKET, r2PublicUrl } from "@/lib/r2";
import { eq, isNotNull } from "drizzle-orm";

/**
 * Backfill one-shot (URLs R2 legacy `{base}/{bucket}/{key}` →
 * `{bucketBase}/{key}`). Idempotent (les URLs déjà correctes sont
 * ignorées). DRY-RUN par défaut ; `--apply` pour écrire.
 * Nécessite R2_PUBLIC_LOGOS_BASE / R2_PUBLIC_SHOTS_BASE dans .env.local.
 */
function fixUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null; // Déjà au nouveau format (ou externe) : intact.
  const key = url.slice(i + marker.length);
  if (!key || key.includes("://")) return null;
  return r2PublicUrl(bucket, key);
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE APPLY" : "MODE DRY-RUN (ajouter --apply pour écrire)");

  const prods = await db
    .select({ id: products.id, slug: products.slug, iconUrl: products.iconUrl })
    .from(products)
    .where(isNotNull(products.iconUrl));
  let prodFixed = 0;
  for (const p of prods) {
    const next = fixUrl(p.iconUrl, PRODUCT_LOGOS_BUCKET);
    if (next && next !== p.iconUrl) {
      console.log(`logo ${p.slug}: ${p.iconUrl} → ${next}`);
      if (apply) {
        await db.update(products).set({ iconUrl: next }).where(eq(products.id, p.id));
      }
      prodFixed++;
    }
  }

  const shots = await db
    .select({
      id: productScreenshots.id,
      productId: productScreenshots.productId,
      url: productScreenshots.url,
    })
    .from(productScreenshots);
  let shotsFixed = 0;
  for (const s of shots) {
    const next = fixUrl(s.url, PRODUCT_SHOTS_BUCKET);
    if (next && next !== s.url) {
      console.log(`shot ${s.id}: ${s.url} → ${next}`);
      if (apply) {
        await db
          .update(productScreenshots)
          .set({ url: next })
          .where(eq(productScreenshots.id, s.id));
      }
      shotsFixed++;
    }
  }
  console.log(
    `OK: ${prodFixed} logos, ${shotsFixed} captures ${apply ? "réécrits" : "(dry-run)"}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
