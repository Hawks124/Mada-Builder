/**
 * Vérif 0057 — un seul build PENDING par produit, arbitré par la base.
 *
 * Ferme la course du pré-check `stillPending` (read-then-write TOCTOU :
 * deux envois simultanés lisaient tous deux « rien en revue » et
 * inséraient tous deux). Même mécanique que verify-0056 : TOUT dans UNE
 * transaction annulée en fin par un throw volontaire (aucun résidu),
 * chaque scénario d'échec dans un SAVEPOINT isolé. Connexion directe
 * (owner, RLS de la table D1 est deny-all service-side de toute façon).
 *
 * Ce que ça prouve :
 * - l'index partiel 0057 existe, est UNIQUE et n'arbitre QUE les pending ;
 * - un second pending (version différente) lève 23505 avec la contrainte
 *   `product_builds_one_pending_uidx` — le champ `constraint_name` est
 *   exposé directement OU via `cause` (Drizzle) et le service le lit.
 * - un build rejeté libère la place : le re-send survit (contrat D6).
 *
 * Pré-check d'application (l'index aurait échoué sinon, noté dans
 * l'en-tête de la migration) : 0 doublon pending au 2026-10-29
 * (0 pending, 12 builds).
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0057-one-pending-uidx.ts`
 */
import "./_env";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    pass += 1;
    console.log(`  ok: ${name}`);
  } else {
    fail += 1;
    console.error(`  KO: ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

type PgErr = { code?: string; constraint_name?: string };

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante.");
  if (process.env.VERIFY_ALLOW_PROD !== "1") {
    console.error(
      "  Base de production possible. Relance avec VERIFY_ALLOW_PROD=1 si c'est intentionnel.",
    );
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false, max: 1 });
  const suffix = Date.now().toString(36);

  try {
    await sql.begin(async (tx) => {
      // ── fixtures (le rollback final les efface) ──────────────────────
      const maker = uuidv7();
      await tx`
        INSERT INTO public.users (id, username, display_name, email)
        VALUES (${maker}, ${`u57_${suffix}`}, ${`u57_${suffix}`}, ${`u57_${suffix}@probe.local`})`;
      const product1 = uuidv7();
      await tx`
        INSERT INTO public.products
          (id, slug, maker_id, name, tagline, description, category, status)
        VALUES (
          ${product1}, ${`idx57_${suffix}`}, ${maker}, ${"Probe 0057"},
          ${"fiche probe 0057"}, ${"fiche probe 0057"}, ${"dev-tools"}, 'published'
        )`;

      // 1. L'index 0057 existe, UNIQUE, valide, prédicat = pending seul.
      const [idx] = await tx`
        SELECT i.indisunique, i.indisvalid,
               pg_get_expr(i.indpred, i.indrelid) AS pred
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'product_builds_one_pending_uidx'`;
      check(
        "index produit_builds_one_pending_uidx : unique + valide + WHERE status='pending'",
        Boolean(idx?.indisunique && idx?.indisvalid) &&
          /status\s*=\s*'pending'/.test(String(idx?.pred ?? "")),
        idx,
      );

      // Build A en revue (version 41). id UUIDv7 explicite : le défaut du
      // drizzle ($defaultFn) vit côté client, PAS en base.
      await tx`
        INSERT INTO public.product_builds
          (id, product_id, version_code, version_name, sha256_file, size_bytes, r2_key, status)
        VALUES (
          ${uuidv7()}, ${product1}, 41, 'v41', ${`sha_a_${suffix}`}, 1024,
          ${`builds/u57/p/${product1}/a.apk`}, 'pending'
        )`;

      // 2. Second pending (version différente) → 23505 un-pending.
      //    La contrainte est lisible direct OU via cause (Drizzle) — le
      //    service lisant constraint_name se fie à ce champ.
      let dupCode: string | undefined;
      let dupConstraint: string | null = null;
      await tx.unsafe("SAVEPOINT sp_dup");
      try {
        await tx`
          INSERT INTO public.product_builds
            (id, product_id, version_code, version_name, sha256_file, size_bytes, r2_key, status)
          VALUES (
            ${uuidv7()}, ${product1}, 42, 'v42', ${`sha_b_${suffix}`}, 1024,
            ${`builds/u57/p/${product1}/b.apk`}, 'pending'
          )`;
      } catch (e) {
        const err = e as PgErr;
        dupCode = err.code;
        dupConstraint = err.constraint_name ?? null;
      }
      // Une violation avale la transaction entière : savepoint oblige.
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_dup");
      check("second pending refusé par la base (23505)", dupCode === "23505", {
        code: dupCode,
        constraint: dupConstraint,
      });
      check(
        "contrainte nommée = product_builds_one_pending_uidx (direct OU cause)",
        dupConstraint === "product_builds_one_pending_uidx",
        { constraint: dupConstraint },
      );

      // 3. Le rejet libère la place (index PARTIEL) : re-send D6 survit.
      await tx`
        UPDATE public.product_builds
        SET status = 'rejected', reviewed_at = now()
        WHERE product_id = ${product1} AND version_code = 41`;
      let resendOk = false;
      await tx.unsafe("SAVEPOINT sp_resend");
      try {
        await tx`
          INSERT INTO public.product_builds
            (id, product_id, version_code, version_name, sha256_file, size_bytes, r2_key, status)
          VALUES (
            ${uuidv7()}, ${product1}, 42, 'v42', ${`sha_c_${suffix}`}, 1024,
            ${`builds/u57/p/${product1}/c.apk`}, 'pending'
          )`;
        resendOk = true;
      } catch {
        resendOk = false;
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_resend");
      check("rejet libère : re-send pending passe (contrat D6)", resendOk);

      throw new Error("rollback volontaire — aucun résidu");
    });
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("rollback volontaire")) throw e;
  } finally {
    await sql.end();
  }

  console.log(`\n${pass} ok, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
