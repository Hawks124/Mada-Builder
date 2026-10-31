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
 * Ce que ça prouve (doctrine sondée sur la base réelle — probes) :
 * - la policy `user_devices_update_policy` corrigée (0056, USING
 *   invités-ou-soi-même) : hijack cross-user = 0 ligne, vol = 0 ligne ;
 * - le flux INVITÉ SURVIT : anon inscrit son appareil (INSERT sans
 *   RETURNING — anon n'a ni SELECT accordé ni token lisible) ; aucun
 *   caller ne touche une ligne possédée ;
 * - le CLAIM invité→utilisateur reste une affaire SERVICE (la policy
 *   SELECT masque les NULL à tout authenticated depuis 0053 — l'upsert
 *   client le paie pareil) : la voie = API web avec service_role, qui
 *   bypass la RLS ; 0056 ne change RIEN ici.
 * - la claim CIBLÉE d'un invité par authenticated = 0 ligne : l'EXPLAIN
 *   réel montre qu'un UPDATE qui LIT des colonnes (WHERE ou RETURNING)
 *   se voit ajouter un conjoint `user_id = auth.uid()` (l'équivalent
 *   select-policy) — l'invité n'y passe pas ; l'équivalent anon est
 *   mort avant le RLS : GRANT SELECT révoqué (hint Postgres lisible) ;
 * - le blanket AVEC RETURNING ne retient que les lignes possédées
 *   (le RETURNING lit les colonnes retournées → même conjoint) ;
 * - `product_revisions_insert_own` en AND : révision sur la fiche
 *   d'AUTRUI = refus 42501 ; la révision du propriétaire passe.
 *
 * Trou RÉSIDUEL PROUVÉ (assumé, CodeRabbit — finding 6) : un UPDATE
 * AVEUGLE (SANS WHERE, SANS RETURNING) ne lit AUCUNE colonne : son plan
 * ne porte PAS le conjoint (EXPLAIN réel) — quiconque tient UPDATE
 * vise en masse sans lecture :
 *   - authenticated : `SET user_id = self` (sans WHERE) rapproche
 *     TOUS les invités du caller (claim de masse — le trou 0056,
 *     corrigé aux ciblés, survit à l'aveugle) ;
 *   - anon : `SET is_active = false` (sans WHERE) éteint tous les
 *     invités ; le ciblé anon, lui, est mort au GRANT (SELECT
 *     révoqué, voulu).
 * Le verify encode le RÉEL : ciblés / avec-RETURNING = 0 ligne,
 * aveugle = >= 1 (flow CodeRabbit). Fermer l'aveugle demandera un RPC
 * SECURITY DEFINER vérifiant le token, côté squad mobile, hors V1.
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

      // 3. UPDATE blanket AVEC RETURNING : 0 ligne. Le RETURNING lit les
      //    colonnes retournées → le plan porte le conjoint
      //    `user_id = auth.uid()` (EXPLAIN réel) : seules les lignes
      //    POSSEDÉES survivraient — la fixture n'en a aucune pour m2 →
      //    rien d'attaquable par la forme lisible. (La forme AVEUGLE,
      //    sans RETURNING, est le trou prouvé au 4b.)
      const blanket = await tx`
        UPDATE public.user_devices SET user_id = ${m2} RETURNING id`;
      check("UPDATE blanket avec RETURNING = 0 ligne", blanket.length === 0, blanket);

      // 4. La claim CIBLÉE d'une ligne invité par un authenticated = 0
      //    ligne : le WHERE lit `id` → le plan ajoute le conjoint
      //    select-like au-dessus du USING (EXPLAIN réel) — l'invité
      //    (user_id NULL) n'y passe pas ; la réclamation reste une
      //    affaire SERVICE (policy SELECT masque les NULL, 0053).
      const claimByAuth = await tx`
        UPDATE public.user_devices SET user_id = ${m2} WHERE id = ${guest}`;
      check(
        "authenticated ne réclame pas une ligne invité = 0 ligne (claim = service)",
        (claimByAuth as unknown as Countable).count === 0,
        claimByAuth,
      );

      // 4b. TROU RÉSIDUEL PROUVÉ (CodeRabbit, finding 6) : l'attaque
      //     AVEUGLE — `SET user_id = self` sans WHERE ni RETURNING — ne
      //     lit AUCUNE colonne : son plan ne porte PAS le conjoint
      //     (EXPLAIN réel), l'USING seul gouverne, et l'invité y passe
      //     (`user_id IS NULL`) → la claim de MASSE flippE la sonde
      //     (>= 1). Le blanket avec RETURNING au 3 ci-dessus ne couvre
      //     PAS cette variante — d'où l'assertion en adéquation avec le
      //     réel. Le flip est annulé : le check 5b a besoin d'un invité
      //     toujours `user_id NULL`.
      await tx.unsafe("SAVEPOINT sp_claimwide");
      const claimWide = (await tx`
        UPDATE public.user_devices SET user_id = ${m2}`) as unknown as Countable;
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_claimwide");
      check(
        "trou résiduel prouvé : claim AVEUGLE des invités (>= 1, variante sans-RETURNING)",
        (claimWide.count ?? 0) >= 1,
        claimWide,
      );

      // 5. Anon : écrire sans lire — il inscrit un invité (SANS
      //    RETURNING : anon n'a ni SELECT accordé ni token lisible).
      //    Claims fidèles à PostgREST : {"role":"anon"} SANS sub —
      //    auth.uid() devient NULL (un sub vide provoquerait un
      //    `''::uuid` = 22P02, artefact de sonde, pas le réel).
      await tx.unsafe("SET LOCAL ROLE anon");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [`{"role": "anon"}`]);
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
        // 5b. TROU RÉSIDUEL PROUVÉ — variante anon : un UPDATE ciblé
        //     échoue au GRANT (SELECT révoqué — lire fcm_token/id est
        //     interdit), mais l'AVEUGLE (sans WHERE ni RETURNING) ne lit
        //     AUCUNE colonne et son plan ne porte pas le conjoint
        //     select-like → la policy USING n'y retient que la branche
        //     `user_id IS NULL` : l'is_active de TOUS les invités est
        //     flippable (les deux de la sonde : la fixture + celle
        //     insérée au 5), comme la claim de masse authenticated au
        //     4b (variante sans-RETURNING, CodeRabbit).
        const anonWide = await tx`
          UPDATE public.user_devices SET is_active = false`;
        check(
          "risque résiduel prouvé : anon flippE les invités sans les cibler (>= 2)",
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
