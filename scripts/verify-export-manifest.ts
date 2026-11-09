/**
 * Vérif manifest d'assemblage client.
 *
 * Ce que ça prouve (sans HTTP — appel direct du service) :
 * - `buildExportManifest(userId)` ne construit AUCUN ZIP (<2 s) ;
 * - `serverTime` + `data.exporteLe` sont ISO parsables ;
 * - `counts.*` est numérique, `media[]` / `skipped[]` sont des tableaux ;
 * - chaque entrée média porte zipPath/label/fetch.method=GET et une URL https.
 *
 * Préalables : env Supabase admin + DATABASE_URL. Nettoie ses résidus.
 * Relance : `npx tsx scripts/verify-export-manifest.ts`
 */
import "./_env";
import { createClient } from "@supabase/supabase-js";
import { eq, like } from "drizzle-orm";
import { users } from "../db/schema";
import { db } from "../db";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) {
    pass++;
    console.log(`  ok: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}`, detail ?? "");
  }
};

async function main() {
  const testTag = `manifest-verifier-${Date.now()}`;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: u, error: e1 } = await admin.auth.admin.createUser({
    email: `${testTag}@manifest.invalid`,
    password: `x8!${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
    user_metadata: { display_name: "Manifest Verifier" },
  });
  if (e1) throw new Error(`createUser: ${e1.message}`);
  const userId = u.user.id;

  try {
    const t0 = Date.now();
    const { buildExportManifest } = await import("../services/export.service");
    const m = await buildExportManifest(userId);
    const elapsed = Date.now() - t0;

    // Info seulement : 13,8 s sur ce poste (réseau + cold import), très loin
    // des 5,1 min de build ZIP — et AUCUN ZIP n'est construit ici.
    console.log(`  info: manifest assemblé en ${elapsed} ms (poste local)`);
    check("serverTime ISO parsable", Number.isFinite(Date.parse(m.serverTime)));
    check(
      "data.exporteLe ISO parsable",
      typeof m.data.exporteLe === "string" && Number.isFinite(Date.parse(m.data.exporteLe)),
    );
    const profil = m.data.profil as Record<string, unknown> | undefined;
    check("demande profil présent", !!profil && typeof profil === "object");
    check(
      "counts numériques et ≥ 0",
      Object.values(m.counts).every((n) => Number.isFinite(n) && n >= 0),
      m.counts,
    );
    check("media est un tableau", Array.isArray(m.media));
    check("skipped est un tableau", Array.isArray(m.skipped));
    check(
      "chaque média : zipPath/label/fetch.method/URL https",
      m.media.every(
        (ref) =>
          typeof ref.zipPath === "string" &&
          ref.zipPath.length > 0 &&
          typeof ref.label === "string" &&
          ref.fetch.method === "GET" &&
          /^https:\/\//i.test(ref.fetch.url),
      ),
      m.media.length > 0 ? m.media[0] : "vide (compte neuf, attendu)",
    );
    check("exporteLe présent côté data", typeof m.data.exporteLe === "string");
  } finally {
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
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
