// Smoke-test DB : tables publiques + version Postgres. Usage: npx tsx scripts/db-ping.ts
import "./_env";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (.env.local, voir STACK.md)");
  const sql = postgres(url);
  const version = await sql`SELECT version()`;
  console.log("PG:", version[0].version.split(" ").slice(0, 2).join(" "));
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY 1
  `;
  console.log(
    "TABLES:",
    tables.map((t) => t.table_name).join(", ") || "(aucune)",
  );
  await sql.end();
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
