import "./_env";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/services/users.service";

/**
 * Purge des données factices (pré-lancement réel) : produits `seed-%` /
 * `verify-%`, comptes seed/verify (+ Auth). Blast-radius FERMÉ : seuls
 * ces préfixes + emails exacts sont touchés — jamais de données réelles.
 * DRY-RUN par défaut ; `--apply` pour exécuter. Orphelins R2 → sweep
 * (`run-jobs sweep`) après apply. Backup DB conseillé avant apply.
 */
const SEED_EMAILS = ["equipe@mada-made.mg"];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE APPLY" : "MODE DRY-RUN (ajouter --apply pour exécuter)");

  const seedProducts = await db
    .select({ id: products.id, slug: products.slug, status: products.status })
    .from(products)
    .where(or(ilike(products.slug, "seed-%"), ilike(products.slug, "verify-%")));
  console.log(`produits factices: ${seedProducts.length}`);
  for (const p of seedProducts.slice(0, 20)) console.log(`  - ${p.slug} [${p.status}]`);
  if (seedProducts.length > 20) console.log(`  … +${seedProducts.length - 20} autres`);

  const seedUsers = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(
      or(...SEED_EMAILS.map((e) => eq(users.email, e)), ilike(users.email, "verify-%@example.com")),
    );
  console.log(`comptes factices: ${seedUsers.length}`);
  for (const u of seedUsers) console.log(`  - ${u.email} (@${u.username})`);

  if (!apply) {
    console.log("OK (dry-run, rien touché).");
    return;
  }
  for (const p of seedProducts) {
    await db.delete(products).where(eq(products.id, p.id));
  }
  const admin = createAdminClient();
  for (const u of seedUsers) {
    try {
      await deleteAccount(u.id, u.id);
    } catch {
      // Ligne déjà partie : continuer vers Auth.
    }
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  console.log(`OK: ${seedProducts.length} produits + ${seedUsers.length} comptes purgés.`);
  console.log("Suite : run-jobs sweep (orphelins R2).");
}

main().catch((e) => {
  console.error("purge-seed crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
