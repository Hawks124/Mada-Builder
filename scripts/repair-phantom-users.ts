// One-off : comptes fantômes OTP (demandés, jamais validés : aucune
// session complétée). Dry-run par défaut ; --apply pour supprimer
// (auth.users + ligne publique — pas de FK entre les deux, les deux
// suppressions sont requises, sinon orphelin inverse).
// Usage: npx tsx scripts/repair-phantom-users.ts [--apply]
import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { createAdminClient } from "../lib/supabase/admin";

const GRACE_DAYS = 7;
const APPLY = process.argv.includes("--apply");

async function main() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  let page = 1;
  let scanned = 0;
  const phantoms: { id: string; email: string | null; created: string }[] = [];
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    if (data.users.length === 0) break;
    scanned += data.users.length;
    for (const u of data.users) {
      // Jamais de session + assez vieux (grâce aux retardataires du lien).
      if (
        !u.last_sign_in_at &&
        new Date(u.created_at) < cutoff
      ) {
        phantoms.push({
          id: u.id,
          email: u.email ?? null,
          created: u.created_at,
        });
      }
    }
    page++;
  }
  console.log(`Scannés : ${scanned} auth users, fantômes : ${phantoms.length}.`);
  for (const p of phantoms) {
    console.log(`${APPLY ? "DELETE" : "DRY-RUN"} ${p.id} ${p.email ?? "(sans email)"} créé ${p.created}`);
    if (!APPLY) continue;
    const { error } = await admin.auth.admin.deleteUser(p.id);
    if (error) {
      console.log(`  ! auth conservé : ${error.message}`);
      continue;
    }
    await db.delete(users).where(eq(users.id, p.id));
  }
  if (!APPLY) {
    console.log("Dry-run : rien supprimé. Relancer avec --apply pour appliquer.");
  } else {
    console.log(`OK : ${phantoms.length} fantôme(s) traité(s).`);
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
