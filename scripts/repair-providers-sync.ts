// One-off : resynchronise users.providers[] depuis les identités Auth
// (le callback ne miroirait que app_metadata.provider — le provider lié
// en second n'était jamais persisté). Idempotent, rerunnable.
// Usage: npx tsx scripts/repair-providers-sync.ts
import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { createAdminClient } from "../lib/supabase/admin";

const KNOWN = new Set(["github", "google", "email"]);

async function main() {
  const rows = await db.select({ id: users.id, providers: users.providers }).from(users);
  const admin = createAdminClient();
  let repaired = 0;
  for (const row of rows) {
    const { data, error } = await admin.auth.admin.getUserById(row.id);
    if (error || !data.user) {
      console.log(`SKIP ${row.id}: auth introuvable (${error?.message ?? "?"})`);
      continue;
    }
    const live = [...new Set(
      (data.user.identities ?? [])
        .map((i) => i.provider)
        .filter((p) => KNOWN.has(p)),
    )];
    const merged = [...new Set([...row.providers, ...live])];
    const changed =
      merged.length !== row.providers.length ||
      merged.some((p) => !row.providers.includes(p));
    if (!changed) continue;
    console.log(`REPAIR ${row.id}: [${row.providers.join(",")}] → [${merged.join(",")}]`);
    await db
      .update(users)
      .set({ providers: merged, updatedAt: new Date() })
      .where(eq(users.id, row.id));
    repaired++;
  }
  console.log(`OK: ${rows.length} ligne(s), ${repaired} resynchronisée(s).`);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
