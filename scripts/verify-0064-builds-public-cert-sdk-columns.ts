/**
 * Vérif T6-bis/0064 — la surface PostgREST de `product_builds` passe à
 * TREIZE colonnes publiques (les 10 de 0062 + `cert_sha256`, `min_sdk`,
 * `target_sdk`), tout le RESTE reste 42501 — `r2_key` en tête.
 *
 * Même mécanique que verify-0062 : TOUT dans UNE transaction annulée
 * en fin par un throw volontaire (aucun résidu) ; SET LOCAL ROLE +
 * claims JWT locaux reproduisent EXACTEMENT ce que PostgREST voit pour
 * anon / authenticated. Les erreurs attendues s'exécutent dans un
 * SAVEPOINT isolé (une erreur Postgres aborte sinon toute la
 * transaction).
 *
 * Ce que ça prouve (après application des migrations 0062 + 0064) :
 * - la surface grantée est EXACTEMENT la liste des 13 ci-dessous —
 *   le littéral dur, verrou identique côté natif
 *   (supabase_product_service.dart L27-40, doc-comment « GATE DE
 *   RELEASE ») : toute divergence d'un côté se voit à la relecture ;
 * - AUCUNE autre colonne n'est grantée (`r2_key`, cert_sha1,
 *   sig_scheme, cert_subject_*, cert_key_*, cert_sig_alg, permissions,
 *   rejection_reason, reviewed_* — la liste des interdits complète) ;
 * - RLS/policy 0053 STRICTEMENT inchangée (le RLS arbitre les lignes,
 *   le grant arbitre 13 colonnes désormais) ;
 * - anon : les 13 colonnes passent sur l'APPROUVÉ (données SDK/cert
 *   restituées à l'identique), le pending reste invisible (pas
 *   d'oracle), `r2_key` et `select=*` meurent en 42501 franche ;
 * - authenticated : SES builds (pending compris via la policy own)
 *   lisent les 13 colonnes, `r2_key` reste refusée (invariance token) ;
 * - le serveur web (rôle de connexion) lit TOUT — le pipeline D1→D6
 *   n'est pas touché.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0064-builds-public-cert-sdk-columns.ts`
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

/** Les 13 colonnes verrouillées des deux côtés (0062 : les dix ; 0064 :
 * cert_sha256, min_sdk, target_sdk — T6-bis). Littéral dur : la liste
 * EXACTE du canal natif (supabase_product_service.dart L27-40,
 * doc-comment « GATE DE RELEASE »), base sans r2_key. */
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
  "cert_sha256",
  "min_sdk",
  "target_sdk",
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
        [m1, `g64_m1_${suffix}`],
        [m2, `g64_m2_${suffix}`],
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
          ${product1}, ${`g64_probe_${suffix}`}, ${m1}, ${"Probe 0064"},
          ${"fiche de m1"}, ${"fiche de m1"}, ${"dev-tools"}, 'published'
        )`;
      const keyApproved = `builds/${m1}/${product1}/0064-approved-${suffix}.apk`;
      const keyPending = `builds/${m1}/${product1}/0064-pending-${suffix}.apk`;
      const approved = uuidv7();
      await tx`
        INSERT INTO public.product_builds
          (id, product_id, r2_key, sha256_file, size_bytes, status, version_code,
           package, cert_sha256, min_sdk, target_sdk)
        VALUES
          (${approved}, ${product1}, ${keyApproved},
           ${"aa".repeat(32)}, ${12345}, 'approved', 47, ${"probe.builds.one"},
           ${"cc".repeat(32)}, ${26}, ${34})`;
      const pending = uuidv7();
      await tx`
        INSERT INTO public.product_builds
          (id, product_id, r2_key, sha256_file, size_bytes, status, version_code,
           package, cert_sha256, min_sdk, target_sdk)
        VALUES
          (${pending}, ${product1}, ${keyPending},
           ${"bb".repeat(32)}, ${23456}, 'pending', 48, ${"probe.builds.one"},
           NULL, NULL, NULL)`;

      // 1. La policy 0053 est TOUJOURS la même (rien de touché côté RLS).
      const [pol] = await tx`
        SELECT qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'product_builds'
          AND policyname = 'product_builds_select_approved_or_own'`;
      const qual = String(pol?.qual ?? "");
      check(
        "policy approuvés-or-own inchangée (0064 : le RLS n'arbitre toujours que les lignes)",
        qual.includes("status = 'approved" as string) && qual.includes("auth.uid()"),
        qual,
      );

      // 2. La surface du GRANT (information_schema = vérité) : EXACTEMENT
      //    les 13 colonnes du littéral, pour anon ET authenticated.
      for (const role of ["anon", "authenticated"]) {
        const cols = await tx`
          SELECT column_name FROM information_schema.column_privileges
          WHERE table_schema = 'public' AND table_name = 'product_builds'
            AND grantee = ${role}`;
        const got = cols.map((c) => String(c.column_name)).sort();
        const want = [...GRANTED_COLS].sort();
        check(
          `grant ${role} : exactement les 13 colonnes verrouillées`,
          got.length === want.length && got.every((c, i) => c === want[i]),
          got,
        );
      }

      // 2b. La liste des interdits : AUCUNE autre colonne grantée
      //     (couvre tout ajout futur de colonne non verrouillée).
      for (const role of ["anon", "authenticated"]) {
        const leaks = await tx`
          SELECT column_name FROM information_schema.column_privileges
          WHERE table_schema = 'public' AND table_name = 'product_builds'
            AND grantee = ${role}
            AND column_name != ALL(${[...GRANTED_COLS]})`;
        check(`grant ${role} : aucune colonne hors les 13`, leaks.length === 0, leaks);
      }

      // 3. Le serveur web (rôle de connexion) : FULL accès intact.
      const [serverRow] = await tx`
        SELECT r2_key, cert_sha256, min_sdk, target_sdk
        FROM public.product_builds WHERE id = ${approved}`;
      check(
        "serveur web : r2_key lisible + colonnes 0064 visibles (pipeline D1→D6 intouché)",
        serverRow?.r2_key === keyApproved &&
          serverRow?.cert_sha256 === "cc".repeat(32) &&
          Number(serverRow?.min_sdk) === 26 &&
          Number(serverRow?.target_sdk) === 34,
        serverRow,
      );

      // 4. anon : la cible r2_key — 42501 franche.
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

      // 4b. anon : un `select=*` meurt aussi (une colonne non grantée
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

      // 5. anon : les 13 colonnes passent — roundtrip exact des
      //    données SDK/cert — et la policy 0053 continue d'arbitrer :
      //    seul l'APPROUVÉ est visible (pas d'oracle) ; min_sdk et
      //    target_sdk du fixture restitués exacts (absent = null,
      //    jamais inventé).
      const anonRows = await tx`
        SELECT id, version_code, version_name, package, size_bytes, whatsnew,
               status, sha256_file, created_at, cert_sha256, min_sdk, target_sdk
        FROM public.product_builds
        WHERE product_id = ${product1}`;
      const onlyApproved =
        anonRows.length === 1 && anonRows[0]?.id === approved && anonRows[0]?.status === "approved";
      const certRound =
        anonRows[0]?.cert_sha256 === "cc".repeat(32) &&
        Number(anonRows[0]?.min_sdk) === 26 &&
        Number(anonRows[0]?.target_sdk) === 34;
      check(
        "anon : seuls les approuvés visibles + 13 colonnes lisibles (cert/SDK exacts)",
        onlyApproved && certRound,
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
        await tx`SELECT r2_key FROM public.product_builds LIMIT 1`;
      } catch (e) {
        authKeyDenied = (e as PgErr).code === "42501";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_auth_key");
      check("authenticated select r2_key → 42501", authKeyDenied);

      // 6b. authenticated (own) : SON pending reste lisible — policy own —
      //     sur les 13 colonnes ; les colonnes NULL du fixture reviennent
      //     NULL (null réel, jamais inventé).
      const authPending = await tx`
        SELECT id, status, cert_sha256, min_sdk, target_sdk
        FROM public.product_builds WHERE id = ${pending}`;
      check(
        "authenticated : son pending lisible sur les 13 colonnes (SDK/cert NULL = null)",
        authPending.length === 1 &&
          authPending[0]?.id === pending &&
          authPending[0]?.status === "pending" &&
          authPending[0]?.cert_sha256 === null &&
          authPending[0]?.min_sdk === null &&
          authPending[0]?.target_sdk === null,
        authPending,
      );

      // Fin : abort volontaire → ROLLBACK total (aucun résidu, base
      // partagée intacte). Le catch extérieur filtre ce message exact.
      throw new Error("rollback-volontaire: les fixtures ne persistent pas");
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("rollback-volontaire")) {
      // prévu
    } else {
      throw e;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`verify-0064: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-0064 échoué:", e);
  process.exit(1);
});
