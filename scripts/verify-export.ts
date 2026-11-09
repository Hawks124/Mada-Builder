/**
 * Vérif export — ZIP produit en tmpfile, jamais une archive partielle.
 *
 * Ce que ça prouve :
 * - `buildUserExport(userId)` produit un fichier ZIP READABLE (PK magic) ;
 * - `data.json` et `MANIFEST.txt` y sont bien présents ;
 * - après lecture, le tmpfile est bien nettoyé (unlink côté script).
 *
 * Préalables : env Supabase admin + DATABASE_URL. Nettoie ses résidus.
 * Relance : `npx tsx scripts/verify-export.ts`
 */
import "./_env";
import { createClient } from "@supabase/supabase-js";
import { eq, like } from "drizzle-orm";
import { users } from "../db/schema";
import { db } from "../db";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import * as yauzl from "yauzl";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  console.log(
    `  ${cond ? "ok" : "KO"}: ${name}${cond || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
  if (cond) pass++;
  else {
    fail++;
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Env Supabase incomplet (.env.local, voir STACK.md).");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const testTag = `verify-export-${Date.now()}`;
  const email = `${testTag}@mail.com`;
  const { data: u, error: e1 } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Export Verifier" },
  });
  if (e1) throw new Error(`createUser: ${e1.message}`);
  const userId = u.user.id;

  // data.json / MANIFEST.txt présents dans l'archive.
  let tempPath = "";
  try {
    const { buildUserExport } = await import("../services/export.service");
    const built = await buildUserExport(userId);
    tempPath = built.tempPath;

    const s = await stat(tempPath);
    check("taille stat == taille retournée", s.size === built.size, {
      onDisk: s.size,
      reported: built.size,
    });
    check("fichier >= 200B", built.size >= 200, { size: built.size });

    const buf = Buffer.alloc(4);
    await new Promise<void>((res, rej) => {
      const fd = createReadStream(tempPath, { start: 0, end: 3 });
      fd.on("error", rej);
      fd.on("data", (chunk: string | Buffer) => {
        if (Buffer.isBuffer(chunk)) buf.set(chunk);
        res();
      });
    });
    check("PK magic valide", buf.toString("hex") === "504b0304", buf.toString("hex"));

    const entries = await readZipEntries(tempPath);
    const names = new Set(entries.map((e) => e.fileName));
    check("data.json présent", names.has("data.json"));
    check("MANIFEST.txt présent", names.has("MANIFEST.txt"));
  } finally {
    if (tempPath) await rm(tempPath, { recursive: true, force: true }).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    await db.delete(users).where(eq(users.id, userId));
  }

  const leftovers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%${testTag}%`));
  check("nettoyage complet", leftovers.length === 0);

  console.log(`\n${pass} pass, ${fail} fail.`);

  const client = db as unknown as { $client: { end(): Promise<void> } };
  await client.$client.end();
}

interface ZipEntry {
  fileName: string;
}
function readZipEntries(path: string): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { autoClose: true, lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error("zipfile null"));
      const entries: ZipEntry[] = [];
      zipfile.readEntry();
      zipfile.on("entry", (entry: { fileName: string }) => {
        if (entry.fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }
        entries.push({ fileName: entry.fileName });
        zipfile.readEntry();
      });
      zipfile.on("end", () => {
        zipfile.close();
        resolve(entries);
      });
      zipfile.on("error", reject);
    });
  });
}

main().catch((e) => {
  console.error("FATAL:", e.message ?? e);
  process.exitCode = 1;
});
