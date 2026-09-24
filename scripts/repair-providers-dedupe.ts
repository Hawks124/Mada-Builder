// One-off : déduplique users.providers (bug array_append aveugle —
// addAuthProvider est désormais idempotent, ce script ne devrait plus
// jamais rien trouver). Usage: npx tsx scripts/repair-providers-dedupe.ts
import "./_env";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

async function main() {
  const before = await db.select({ id: users.id, providers: users.providers }).from(users);
  let repaired = 0;
  for (const row of before) {
    const clean = [...new Set(row.providers)];
    if (clean.length !== row.providers.length) {
      console.log(`REPAIR ${row.id}: [${row.providers.join(",")}] → [${clean.join(",")}]`);
      await db
        .update(users)
        .set({ providers: clean, updatedAt: new Date() })
        .where(sql`${users.id} = ${row.id}`);
      repaired++;
    }
  }
  console.log(`OK: ${before.length} ligne(s) inspectée(s), ${repaired} réparée(s).`);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
