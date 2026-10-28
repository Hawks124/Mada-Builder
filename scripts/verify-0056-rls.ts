/**
 * Vérif RLS 0056 — les deux trous confirmés par la revue CodeRabbit.
 *
 * Même mécanique que verify-mobile-direct : TOUT dans UNE transaction
 * annulée en fin par un throw volontaire (aucun résidu) ; les rôles
 * `authenticated` / `anon` + claims JWT locaux (set_config) reproduisent
 * EXACTEMENT ce que PostgREST voit quand l'app mobile écrit en direct.
 * Chaque scénario de REFUS s'exécute dans un SAVEPOINT isolé (une erreur
 * Postgres aborte sinon toute la transaction).
 *
 * Ce que ça prouve :
 * - la policy `user_devices_update_policy` corrigée (0056, USING
 *   invités-ou-soi-même) : hijack cross-user = 0 ligne, UPDATE blanket
 *   = 0 ligne sur les lignes possédées, vol = 0 ligne ;
 * - le flux INVITÉ SURVIT : anon inscrit son appareil (INSERT sans
 *   RETURNING — anon n'a ni SELECT accordé ni token lisible) ; aucun
 *   caller ne touche une ligne possédée ;
 * - le CLAIM invité→utilisateur reste une affaire SERVICE (la policy
 *   SELECT masque les NULL à tout authenticated depuis 0053 — l'upsert
 *   client le paie pareil) : la voie = API web avec service_role, qui
 *   bypass la RLS ; 0056 ne change RIEN ici.
 * - `product_revisions_insert_own` en AND : révision sur la fiche
 *   d'AUTRUI = refus 42501 ; la révision du propriétaire passe.
 *
 * Risque résiduel PROUVÉ (assumé, CodeRabbit) : une ligne INVITÉ reste
 * gérable par n'importe quel anon — un UPDATE ciblé échoue au GRANT
 * (SELECT révoqué, voulu), mais un UPDATE SANS WHERE ne lit aucune
 * colonne, passe le grant, et la policy USING n'y retient que les
 * lignes invitées : l'is_active de tous les invités est flippable.
 * La fermer demandera un RPC SECURITY DEFINER vérifiant le token,
 * côté squad mobile.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0056-rls.ts`
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
type Countable = { count?: number };

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
      const m1 = uuidv7(); // maker légitime (fiche + device)
      const m2 = uuidv7(); // l'attaquant
      for (const [id, uname] of [
        [m1, `rls_m1_${suffix}`],
        [m2, `rls_m2_${suffix}`],
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
          ${product1}, ${`rls_probe_${suffix}`}, ${m1}, ${"Probe 0056"},
          ${"fiche de m1"}, ${"fiche de m1"}, ${"dev-tools"}, 'published'
        )`;
      const dev1 = uuidv7(); // appareil POSSÉDÉ par m1
      await tx`
        INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
        VALUES (${dev1}, ${m1}, ${`tok_m1_${suffix}`}, 'android')`;
      const guest = uuidv7(); // appareil INVITÉ (user_id NULL)
      await tx`
        INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
        VALUES (${guest}, NULL, ${`tok_guest_${suffix}`}, 'android')`;

      // 1. Les policies corrigées sont bien posées (0056).
      const [pol] = await tx`
        SELECT qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_devices'
          AND policyname = 'user_devices_update_policy'`;
      const qual = String(pol?.qual ?? "");
      check(
        "user_devices_update_policy : USING = invités OU soi-même",
        qual.includes("user_id IS NULL") && qual.includes("auth.uid()"),
        qual,
      );
      const [rev] = await tx`
        SELECT with_check FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'product_revisions'
          AND policyname = 'product_revisions_insert_own'`;
      const wcheck = String(rev?.with_check ?? "");
      check("product_revisions_insert_own : AND présent", wcheck.includes("AND"), wcheck);

      // 2. m2 (authenticated) NE PEUT PAS hijacker la ligne de m1.
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${m2}", "role": "authenticated"}`,
      ]);
      const hijack = await tx`
        UPDATE public.user_devices SET user_id = ${m2} WHERE id = ${dev1} RETURNING id`;
      check("hijack de la ligne d'autrui = 0 ligne", hijack.length === 0, hijack);

      // 3. UPDATE blanket (sans WHERE) : seules les lignes VISIBLES sont
      //    ciblées — les invités ne passent pas la SELECT policy, les
      //    possédées pas le USING corrigé → 0 ligne.
      const blanket = await tx`
        UPDATE public.user_devices SET user_id = ${m2} RETURNING id`;
      check("UPDATE blanket = 0 ligne (rien d'attaquable)", blanket.length === 0, blanket);

      // 4. Un authenticated ne voit/gère PAS les lignes invitées
      //    (policy SELECT — c'est le comportement depuis 0053, voulu) :
      //    le claim invité→utilisateur est une affaire SERVICE.
      const claimByAuth = await tx`
        UPDATE public.user_devices SET user_id = ${m2} WHERE id = ${guest}`;
      check(
        "authenticated ne réclame pas une ligne invité = 0 ligne (claim = service)",
        (claimByAuth as unknown as Countable).count === 0,
        claimByAuth,
      );

      // 5. Anon : écrire sans lire — il inscrit un invité (SANS
      //    RETURNING : anon n'a ni SELECT accordé ni token lisible).
      await tx.unsafe("SET LOCAL ROLE anon");
      await tx.unsafe("SAVEPOINT sp_anon");
      let anonInsertOk = false;
      try {
        await tx`
          INSERT INTO public.user_devices (user_id, fcm_token, platform)
          VALUES (NULL, ${`tok_anon_${suffix}`}, 'ios')`;
        anonInsertOk = true;
      } catch {
        anonInsertOk = false;
      }
      if (anonInsertOk) await tx.unsafe("RELEASE SAVEPOINT sp_anon");
      else await tx.unsafe("ROLLBACK TO SAVEPOINT sp_anon");
      check("anon inscrit toujours un appareil invité", anonInsertOk);
      if (anonInsertOk) {
        // 5b. RISQUE RÉSIDUEL PROUVÉ : un UPDATE ciblé échoue au GRANT
        //     (SELECT révoqué — lire fcm_token/id est interdit), mais un
        //     UPDATE SANS WHERE ne lit AUCUNE colonne, passe le grant,
        //     et la policy USING n'y retient que les lignes invitées →
        //     l'is_active de TOUS les invités est flippable (au moins
        //     les deux de cette sonde : la fixture + celle d'à côté).
        const anonWide = await tx`
          UPDATE public.user_devices SET is_active = false`;
        check(
          "risque résiduel prouvé : anon flipp les invités sans les cibler (>= 2)",
          ((anonWide as unknown as Countable).count ?? 0) >= 2,
          anonWide,
        );
      }

      // 6. Révisions : m2 ne peut pas poser de révision sur la fiche de
      //    m1 (l'ancien OR le permettait → empoisonnement de la file).
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${m2}", "role": "authenticated"}`,
      ]);
      let revRefused = false;
      await tx.unsafe("SAVEPOINT rev_probe");
      try {
        await tx`
          INSERT INTO public.product_revisions (product_id, maker_id, payload)
          VALUES (${product1}, ${m2}, ${JSON.stringify({ tagline: "empoisonné" })}::jsonb)`;
      } catch (e) {
        revRefused = (e as PgErr).code === "42501";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT rev_probe");
      check("révision sur la fiche d'autrui refusée (42501)", revRefused);

      // 7. Le propriétaire pose TOUJOURS sa révision (flux web intact).
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${m1}", "role": "authenticated"}`,
      ]);
      const [ownRev] = await tx`
        INSERT INTO public.product_revisions (product_id, maker_id, payload)
        VALUES (${product1}, ${m1}, ${JSON.stringify({ tagline: "mienne" })}::jsonb)
        RETURNING id`;
      check("révision du propriétaire sur SA fiche = passe", Boolean(ownRev?.id));

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
