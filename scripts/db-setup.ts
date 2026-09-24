// Applique db/setup.sql (trigger, RLS, buckets — idempotent), instruction
// par instruction (jamais de monolithe multi-statements : un verrou
// bloquait tout le script et les runs orphelins s'accumulaient — saga QA).
// Usage: npm run db:setup  (DATABASE_URL requise, pooler en prod)
import "./_env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const LOCK_TIMEOUT = "15s";
const STATEMENT_TIMEOUT = "120s";
const STALE_SECONDS = 60;

/**
 * Découpe naive mais suffisante pour setup.sql (style une instruction
 * par bloc, terminée par `;` en fin de ligne) : respecte les blocs
 * dollar-quotés (`$$ ... $$`, corps de fonction) et ignore les lignes
 * de commentaires. Échoue vite si un bloc reste ouvert (fichier tronqué).
 */
function splitStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current: string[] = [];
  let inDollar = false;
  for (const rawLine of sqlText.split("\n")) {
    const line = rawLine;
    const opens = (line.match(/\$\$/g) ?? []).length;
    if (opens % 2 === 1) inDollar = !inDollar;
    const stripped = line.trim();
    if (!inDollar && (stripped === "" || stripped.startsWith("--"))) continue;
    current.push(line);
    if (!inDollar && stripped.endsWith(";")) {
      statements.push(current.join("\n"));
      current = [];
    }
  }
  if (inDollar) throw new Error("Bloc $$ non fermé dans setup.sql");
  const rest = current.join("\n").trim();
  if (rest !== "") {
    throw new Error(`Texte résiduel sans ";" final : ${rest.slice(0, 60)}`);
  }
  return statements;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (.env.local, voir STACK.md)");

  const file = path.join(process.cwd(), "db", "setup.sql");
  const statements = splitStatements(await readFile(file, "utf-8"));
  console.log(`setup.sql : ${statements.length} instruction(s) à appliquer.`);

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    // Bornes : échec rapide sur verrou (retry propre), jamais de pendaison.
    // Littéraux inline (pas de bind : SET n'accepte pas les paramètres).
    await sql.unsafe(`SET lock_timeout = '${LOCK_TIMEOUT}'`);
    await sql.unsafe(`SET statement_timeout = '${STATEMENT_TIMEOUT}'`);

    // Pré-vol : verrous en attente > 60 s = pileup en cours → on refuse
    // de l'aggraver (diagnostiquer d'abord, relancer ensuite).
    const stuck = await sql`
      SELECT count(*)::int AS n
      FROM pg_catalog.pg_locks AS l
      JOIN pg_catalog.pg_stat_activity AS a ON a.pid = l.pid
      WHERE NOT l.granted
        AND a.query_start < now() - make_interval(secs => 60)
        AND a.query NOT LIKE '%pg_stat_activity%'
    `;
    if ((stuck[0]?.n ?? 0) > 0) {
      throw new Error(
        `Verrous en attente > ${STALE_SECONDS}s détectés : diagnostiquer (pg_locks) avant de relancer, pas d'empilement.`,
      );
    }

    let applied = 0;
    for (const stmt of statements) {
      await sql.unsafe(stmt);
      applied++;
    }
    console.log(
      `OK: db/setup.sql appliqué (${applied}/${statements.length}, trigger, RLS, buckets).`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
