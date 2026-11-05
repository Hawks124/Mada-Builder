/**
 * Vérif 0063 — premier vote / avis / commentaire IMMÉDIAT : la garde
 * d'âge « compte < 1 h » est levée, le shadow-weighting 24 h reste le
 * bouclier du classement (checkVoter côté web, posé à l'écriture).
 *
 * Même mécanique que verify-0062 : TOUT dans UNE transaction annulée
 * en fin par un throw volontaire (aucun résidu) ; SET LOCAL ROLE +
 * claims JWT locaux reproduisent EXACTEMENT ce que PostgREST voit pour
 * authenticated. Les refus s'exécutent dans un SAVEPOINT isolé.
 *
 * Ce que ça prouve (après application de la migration 0063) :
 * - la fonction du pont n'opère plus AUCUNE filtre d'âge :
 *   pg_get_functiondef ne contient ni « interval '1 hour' » ni la
 *   raison machine `account_too_young` ;
 * - un compte tout frais (created_at = now) POSE : un avis, un
 *   commentaire et un vote de commentaire (trois canaux directs) ;
 * - les gardes restantes sont INTACTES et produisent leurs raisons
 *   EXACTES : banni (`account_banned`), produit non publié
 *   (`product_not_published`), veille (`curated`), parent fantôme de
 *   réponse comme de vote de commentaire (`parent_not_found`) ;
 * - le flood 20/60 s s'applique à un compte tout frais aussi : les
 *   20 premières écritures passent, la 21e meurt (`flood`) — le filet
 *   global reste le seul plafond instantané ;
 * - ANTI-DÉRIVE MIROIR : le garde de `db/setup.sql` (reconstruit lors
 *   des db:setup) refuse lui aussi le parent fantôme — la forme
 *   périmée 0055 (« existe MAIS supprimé/cross-produit ») qui laissait
 *   passer un parent_id orphelin a disparu du miroir, la forme
 *   positive 0061/0063 y est présente.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0063-lift-account-age-guard.ts`
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

type PgErr = { code?: string; detail?: string; message?: string };

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
      // Les trois comptes de la scène naissent MAINTENANT : si une
      // garde d'âge survivait dans la fonction, C'EST ICI qu'elle
      // frapperait (toute écriture serait refusée).
      const maker = uuidv7();
      const fresh = uuidv7();
      const banned = uuidv7();
      const flooder = uuidv7();
      for (const [id, uname, bannedAt] of [
        [maker, `g63_maker_${suffix}`, null],
        [fresh, `g63_fresh_${suffix}`, null],
        [banned, `g63_banned_${suffix}`, new Date()],
        [flooder, `g63_flood_${suffix}`, null],
      ] as const) {
        await tx`
          INSERT INTO public.users (id, username, display_name, email, created_at, banned_at)
          VALUES (${id}, ${uname}, ${`G63 ${uname}`}, ${`${uname}@probe.local`}, now(), ${bannedAt})`;
      }
      const productA = uuidv7();
      const productCurated = uuidv7();
      const productDraft = uuidv7();
      await tx`
        INSERT INTO public.products (id, slug, maker_id, name, tagline, description, category, status)
        VALUES
          (${productA},       ${`g63-a-${suffix}`},       ${maker}, 'G63 A', 'fiche publiée', 'Fiche de vérif 0063.', 'apps', 'published'),
          (${productCurated}, ${`g63-cur-${suffix}`},     ${maker}, 'G63 Cur', 'veille', 'Fiche en veille.', 'apps', 'published'),
          (${productDraft},   ${`g63-draft-${suffix}`},   ${maker}, 'G63 Draft', 'brouillon', 'Fiche non publiée.', 'apps', 'draft')`;
      await tx`UPDATE public.products SET curated = true WHERE id = ${productCurated}`;

      let sp = 0;
      const asUser = async (uid: string): Promise<void> => {
        await tx.unsafe("RESET ROLE");
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
          `{"sub": "${uid}", "role": "authenticated"}`,
        ]);
      };
      // Refus isolé : savepoint + rollback dans les deux issues (une
      // erreur Postgres aborte sinon toute la transaction).
      const refused = async (fn: () => Promise<unknown>): Promise<PgErr> => {
        sp += 1;
        const name = `g63_sp_${sp}`;
        await tx.unsafe(`SAVEPOINT ${name}`);
        try {
          await fn();
          await tx.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
          return { detail: `PASSE À TORT (attendu refus)`, code: "ok" };
        } catch (e) {
          await tx.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
          return e as PgErr;
        }
      };
      const hasDetail = async (
        fn: () => Promise<unknown>,
        want: string,
        label: string,
      ): Promise<void> => {
        const err = await refused(fn);
        check(label, err.detail?.includes(want) === true, { got: err.detail, want });
      };

      // ── 1. La fonction du pont n'a plus AUCUNE filtre d'âge ───────────
      const [fnRow] = await tx`
        SELECT pg_get_functiondef('public.bridge_writer_guard()'::regprocedure) AS src`;
      const src = String(fnRow?.src ?? "");
      check(
        "garde 0063 : plus de fenêtre « 1 hour » dans la fonction",
        !src.includes("'1 hour'"),
        src.includes("'1 hour'"),
      );
      check(
        "garde 0063 : la raison machine account_too_young est absente du corps (pg_proc)",
        !src.includes("account_too_young"),
        src.length,
      );
      check(
        "garde 0063 : les gardes restantes sont toujours présentes",
        ["account_banned", "product_not_published", "curated", "parent_not_found", "flood"].every(
          (needle) => src.includes(needle),
        ),
      );

      // ── 2. Le compte tout frais POSE trois canaux directs ─────────────
      await asUser(fresh);
      await tx`
        INSERT INTO public.reviews (id, user_id, product_id, rating, body)
        VALUES (${uuidv7()}, ${fresh}, ${productA}, 5, 'Premier avis du tout frais, à l''aise au-dessus de dix.')`;
      const reviewYoung = await tx`
        SELECT id FROM public.reviews WHERE user_id = ${fresh} AND product_id = ${productA}`;
      check("avis : le compte tout frais passe (0063)", reviewYoung.length === 1);
      await tx`
        INSERT INTO public.comments (id, user_id, product_id, body)
        VALUES (${uuidv7()}, ${fresh}, ${productA}, 'Premier commentaire du tout frais.')`;
      const commentId = String(
        (
          await tx`SELECT id FROM public.comments WHERE user_id = ${fresh} AND product_id = ${productA} LIMIT 1`
        )[0].id,
      );
      check("commentaire : le tout frais passe (0063)", Boolean(commentId));
      await tx`
        INSERT INTO public.comment_votes (id, user_id, comment_id, value)
        VALUES (${uuidv7()}, ${fresh}, ${commentId}, 'up')`;
      const cvFresh = await tx`
        SELECT value FROM public.comment_votes WHERE user_id = ${fresh} AND comment_id = ${commentId}`;
      check(
        "vote de commentaire : le tout frais passe (0063)",
        cvFresh.length === 1 && String(cvFresh[0].value) === "up",
        cvFresh.length,
      );

      // ── 3. Les gardes vivantes, RAZOR exact ────────────────────────────
      await asUser(banned);
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${banned}, ${productA}, 5, 'Avis d''un compte suspendu.')`,
        "account_banned",
        "banni : refusé account_banned",
      );

      await asUser(fresh);
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${fresh}, ${productDraft}, 4, 'Avis sur un brouillon omis.')`,
        "product_not_published",
        "avis sur brouillon : refusé product_not_published",
      );
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${fresh}, ${productCurated}, 4, 'Avis sur une veille refusé.')`,
        "curated",
        "avis sur veille : refusé curated",
      );
      await hasDetail(
        () =>
          tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
             VALUES (${uuidv7()}, ${fresh}, ${productA}, ${uuidv7()}, 'Réponse orpheline sur parent fantôme.')`,
        "parent_not_found",
        "réponse parent fantôme : refusé parent_not_found (0061 intact)",
      );
      await hasDetail(
        () =>
          tx`INSERT INTO public.comment_votes (id, user_id, comment_id, value)
             VALUES (${uuidv7()}, ${fresh}, ${uuidv7()}, 'up')`,
        "parent_not_found",
        "vote de commentaire sur fantôme : refusé parent_not_found",
      );

      // ── 4. Flood 20/60 s — le filet s'applique AUSSI au tout frais ────
      await asUser(flooder);
      // 20 écritures libres (aucun savepoint : elles passent franchement
      // et zappent le garde — count 0 → 19 < 20 à chaque fois).
      for (let i = 0; i < 20; i += 1) {
        await tx`INSERT INTO public.comments (id, user_id, product_id, body)
                 VALUES (${uuidv7()}, ${flooder}, ${productA}, ${`Flood ${i}.`})`;
      }
      // 21e : ISOLÉ du reste (une erreur Postgres aborte sinon toute la
      // transaction) — le garde compte 20 écritures < 60 s → flood.
      let floodRefused = false;
      let gotDetail: string | null = null;
      await tx.unsafe("SAVEPOINT g63_flood");
      try {
        await tx`INSERT INTO public.comments (id, user_id, product_id, body)
                 VALUES (${uuidv7()}, ${flooder}, ${productA}, 'Flood 20.')`;
      } catch (e) {
        floodRefused = true;
        gotDetail = (e as PgErr).detail ?? null;
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT g63_flood");
      check(
        "flood : 20 passées puis la 21e refuse (compte tout frais)",
        floodRefused === true && gotDetail !== null && gotDetail.includes("flood"),
        { floodRefused, gotDetail },
      );

      // ── 5. Miroir db/setup.sql — anti-dérive du garde lors des
      // RECONSTRUCTIONS (le miroir ne se déploie pas ; quiconque
      // reconstruit depuis db:setup reçoit SA version du garde). La
      // divergence 0055 : parent testé en forme négative — un
      // parent_id ORPHELIN (pas de FK) passait — 0061/0063 le refusent,
      // le miroir doit refuser aussi.
      const { readFile } = await import("node:fs/promises");
      const setupSql = await readFile("db/setup.sql", "utf8");
      const zone = setupSql.slice(
        setupSql.indexOf("TG_TABLE_NAME = 'comments'"),
        setupSql.indexOf("TG_TABLE_NAME = 'comment_votes'"),
      );
      check(
        "miroir : la forme périmée 0055 (parent orphelin ADMIS) est absente",
        !setupSql.includes("c.deleted_at IS NOT NULL OR c.product_id <> NEW.product_id"),
        setupSql.includes("c.deleted_at IS NOT NULL OR c.product_id <> NEW.product_id"),
      );
      check(
        "miroir : parent fantôme refusé (forme positive 0061/0063 présente)",
        zone.includes("IF NEW.parent_id IS NOT NULL THEN") &&
          zone.includes("IF NOT EXISTS") &&
          zone.includes("WHERE c.id = NEW.parent_id") &&
          zone.includes("AND c.product_id = NEW.product_id") &&
          zone.includes("AND c.deleted_at IS NULL"),
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

  console.log(`verify-0063: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-0063 échoué:", e);
  process.exit(1);
});
