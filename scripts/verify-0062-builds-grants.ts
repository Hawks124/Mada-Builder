/**
 * Vérif T6/0062 — `r2_key` n'est plus lisible via PostgREST.
 *
 * Même mécanique que verify-0056-rls : TOUT dans UNE transaction annulée
 * en fin par un throw volontaire (aucun résidu) ; SET LOCAL ROLE +
 * claims JWT locaux reproduisent EXACTEMENT ce que PostgREST voit pour
 * anon / authenticated. Les erreurs attendues s'exécutent dans un
 * SAVEPOINT isolé (une erreur Postgres aborte sinon toute la transaction).
 *
 * Ce que ça prouve (après la migration 0062 — et restant vrai après la
 * 0064 T6-bis) :
 * - le GRANT pleine ligne de 0053 est remplacé par des grants colonne :
 *   les dix colonnes de 0062 CHACUNE encore grantée (sémantique de
 *   sous-ensemble — depuis 0064 la surface exacte passe à 13 colonnes
 *   et c'est `verify-0064` qui en détient l'autorité) ; `r2_key` absente
 *   des grants des deux rôles, information_schema comme base de vérité ;
 * - anon : `select=r2_key` → 42501 franche ; `select=*` → 42501 (une
 *   colonne non grantée bloque la requête entière) ;
 * - anon : les dix colonnes grantées restent lisibles sur les
 *   SEULES lignes approuvées (policy 0053 inchangée) ;
 * - authenticated : `r2_key` refusé lui aussi (le grant est indépendant
 *   du token), SES builds pending restent lisibles (columns grantées) ;
 * - un pending d'Autrui reste invisible (policy own, 0 ligne) ;
 * - le serveur web (rôle de connexion Drizzle) lit TOUT, r2_key
 *   comprise — le pipeline D1→D6 n'est pas touché.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0062-builds-grants.ts`
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

type PgErr = { code?: string };

/** Les dix colonnes du GRANT SELECT de la migration 0062 — base du
 * SOUS-ENSEMBLE vérifié ici : 0064 (T6-bis) a ajouté `cert_sha256`,
 * `min_sdk`, `target_sdk` à la surface et `verify-0064` verrouille la
 * liste exacte des 13 ; ce verify prouve que ces dix-là restent
 * grantées et que `r2_key` n'y figure jamais. */
const GRANTED_COLS = [
  "id",
  "product_id",
  "version_code",
  "version_name",
  "package",
  "size_bytes",
  "whatsnew",
  "status",
  "sha256_file",
  "created_at",
] as const;

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
      // ── fixtures (rôle de connexion, avant tout SET LOCAL ROLE) ───────
      const m1 = uuidv7(); // maker légitime (produit + builds)
      const m2 = uuidv7(); // spectateur
      for (const [id, uname] of [
        [m1, `gr_m1_${suffix}`],
        [m2, `gr_m2_${suffix}`],
      ] as const) {
        await tx`
          INSERT INTO public.users (id, username, display_name, email)
          VALUES (${id}, ${uname}, ${uname}, ${`${uname}@probe.local`})`;
      }
      const product1 = uuidv7();
      await tx`
        INSERT INTO public.products
          (id, slug, maker_id, name, tagline, description, category, status)
        VALUES (
          ${product1}, ${`gr_probe_${suffix}`}, ${m1}, ${"Probe 0062"},
          ${"fiche de m1"}, ${"fiche de m1"}, ${"dev-tools"}, 'published'
        )`;
      const keyApproved = `builds/${m1}/${product1}/0062-approved-${suffix}.apk`;
      const keyPending = `builds/${m1}/${product1}/0062-pending-${suffix}.apk`;
      const approved = uuidv7();
      await tx`
        INSERT INTO public.product_builds
          (id, product_id, r2_key, sha256_file, size_bytes, status, version_code, package)
        VALUES
          (${approved}, ${product1}, ${keyApproved},
           ${"aa".repeat(32)}, ${12345}, 'approved', 47, ${"probe.builds.one"})`;
      const pending = uuidv7();
      await tx`
        INSERT INTO public.product_builds
          (id, product_id, r2_key, sha256_file, size_bytes, status, version_code, package)
        VALUES
          (${pending}, ${product1}, ${keyPending},
           ${"bb".repeat(32)}, ${23456}, 'pending', 48, ${"probe.builds.one"})`;

      // 1. La policy 0053 est TOUJOURS la même (rien de touché côté RLS).
      const [pol] = await tx`
        SELECT qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'product_builds'
          AND policyname = 'product_builds_select_approved_or_own'`;
      const qual = String(pol?.qual ?? "");
      check(
        "policy approuvés-or-own inchangée",
        qual.includes("status = 'approved" as string) && qual.includes("auth.uid()"),
        qual,
      );

      // 2. La surface du GRANT (information_schema = vérité) : les dix
      //    colonnes de 0062 CONTINUENT d'être grantées à anon ET
      //    authenticated (sémantique de SOUS-ENSEMBLE — 0064 T6-bis a
      //    élargi la surface à 13, la liste exacte est l'affaire du
      //    verify-0064) et `r2_key` reste absente quel que soit le rôle.
      for (const role of ["anon", "authenticated"]) {
        const cols = await tx`
          SELECT column_name FROM information_schema.column_privileges
          WHERE table_schema = 'public' AND table_name = 'product_builds'
            AND grantee = ${role}`;
        const got = cols.map((c) => c.column_name).sort();
        check(
          `grant ${role} : les dix de 0062 toujours grantées (sous-ensemble), r2_key absente`,
          (GRANTED_COLS as readonly string[]).every((c) => got.includes(c)) &&
            !got.includes("r2_key"),
          got,
        );
      }

      // 3. Le serveur web (rôle de connexion) : FULL accès intact.
      const [serverRow] = await tx`
        SELECT r2_key, sha256_file FROM public.product_builds WHERE id = ${approved}`;
      check(
        "serveur web : r2_key lisible (pipeline D1→D6 intouché)",
        serverRow?.r2_key === keyApproved,
        serverRow?.r2_key,
      );

      // 4. anon : la clé d'objet est morte au GRANT — 42501 franche.
      await tx.unsafe("SET LOCAL ROLE anon");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [`{"role": "anon"}`]);
      await tx.unsafe("SAVEPOINT sp_r2_key");
      let anonKeyDenied = false;
      try {
        await tx`SELECT r2_key FROM public.product_builds LIMIT 1`;
      } catch (e) {
        anonKeyDenied = (e as PgErr).code === "42501";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_r2_key");
      check("anon select r2_key → 42501 (permission denied)", anonKeyDenied);

      // 4b. anon : même un `select=*` meurt (une colonne non grantée
      //     dans le * bloque la requête entière — Postgres, pas PostgREST).
      await tx.unsafe("SAVEPOINT sp_star");
      let anonStarDenied = false;
      try {
        await tx`SELECT * FROM public.product_builds LIMIT 1`;
      } catch (e) {
        anonStarDenied = (e as PgErr).code === "42501";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_star");
      check("anon select * → 42501 (colonne non grantée dans le *)", anonStarDenied);

      // 5. anon : les dix colonnes grantées passent — et la policy 0053
      //    continue d'arbitrer : seul l'APPROVÉ est visible (le pending ne
      //    l'est pas — pas d'oracle).
      const anonRows = await tx`
        SELECT id, version_code, version_name, package, size_bytes, whatsnew,
               status, sha256_file, created_at
        FROM public.product_builds
        WHERE product_id = ${product1}`;
      check(
        "anon : seuls les approuvés visibles (pending masqué), colonnes grantées lisibles",
        anonRows.length === 1 && anonRows[0]?.id === approved && anonRows[0]?.status === "approved",
        anonRows,
      );

      // 6. authenticated : le GRANT n'accorde pas la clé même avec un
      //    token valide (indépendance token / grants).
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${m1}", "role": "authenticated"}`,
      ]);
      await tx.unsafe("SAVEPOINT sp_auth_key");
      let authKeyDenied = false;
      try {
        await tx`SELECT r2_key FROM public.product_builds WHERE id = ${approved}`;
      } catch (e) {
        authKeyDenied = (e as PgErr).code === "42501";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_auth_key");
      check("authenticated select r2_key → 42501 (grant, pas la policy)", authKeyDenied);

      // 7. authenticated : le maker lit SES builds (approuvé ET en
      //    revue) avec les colonnes grantées (policy own vivante).
      const ownRows = await tx`
        SELECT id, status, sha256_file, version_code
        FROM public.product_builds
        WHERE product_id = ${product1}
        ORDER BY status`;
      check(
        "maker : ses builds (approved + pending) lisibles, columns grantées",
        ownRows.length === 2 && ownRows.some((r) => r.id === pending),
        ownRows.length,
      );

      // 7b. Un SPECTATEUR (m2, token valide, aucune fiche) : le même
      //     embed ne remonte QUE l'approuvé — le pending d'Autrui
      //     reste invisible (policy own, 0 ligne pour m2).
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${m2}", "role": "authenticated"}`,
      ]);
      const spectatorRows = await tx`
        SELECT id FROM public.product_builds
        WHERE product_id = ${product1} AND status = 'pending'`;
      check("spectateur : le pending d'autrui = 0 ligne (policy own)", spectatorRows.length === 0);

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
