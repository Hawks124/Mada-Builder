/**
 * Vérif du pont d'écriture directe 0055 — avis / commentaires / votes.
 *
 * Principe : TOUT tourne dans UNE transaction annulée en fin par un
 * throw volontaire (postgresql-js rollback) — aucun résidu en base.
 * Le rôle `authenticated` + claims JWT locaux (set_config) reproduisent
 * EXACTEMENT ce que PostgREST voit quand l'app mobile écrit en direct.
 *
 * Les scénarios de REFUS s'exécutent dans un SAVEPOINT isolé (une erreur
 * Postgres aborte sinon toute la transaction) — rollback du savepoint
 * dans les deux issues (refus OU passage à tort).
 *
 * Ce que ça prouve :
 * - les PASSAGES : review/comment/vote de l'auteur légitime, compteurs
 *   (delta + GREATEST au décompte), notifications (kind + titres
 *   exacts, jamais soi-même, pas d'édit), flood jusqu'au seuil 20/60 s ;
 * - la VISIBILITÉ : l'auteur voit ses propres lignes soft-supprimées
 *   (policies SELECT own-row — condition de la reprise) ;
 * - les REFUS : anon, compte jeune/banni, produit draft/curaté, parent
 *   fantôme/cross-produit/supprimé/reply-de-reply, note 1–5,
 *   corps < 10, unicité avis 1/user/produit + vote 1/user/commentaire,
 *   écriture notifications (JAMAIS), UPDATE produits (jamais),
 *   DELETE reviews (jamais accordé — 42501), UPDATE d'autrui (0 ligne) ;
 * - uuidv7 : version 7, variant 10xx, unicité.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-mobile-direct.ts`
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
      // ── fixtures (tout est annulé au ROLLBACK final) ──────────────────
      const maker = uuidv7();
      const tester = uuidv7();
      const young = uuidv7();
      const banned = uuidv7();
      const parentAuthor = uuidv7();
      const productA = uuidv7();
      const productCurated = uuidv7();
      const productDraft = uuidv7();

      const oldCreatedAt = new Date(Date.now() - 2 * 3_600_000);
      for (const [id, uname] of [
        [maker, `bridge_maker_${suffix}`],
        [tester, `bridge_tester_${suffix}`],
        [young, `bridge_young_${suffix}`],
        [banned, `bridge_banned_${suffix}`],
        [parentAuthor, `bridge_parent_${suffix}`],
      ] as const) {
        await tx`
          INSERT INTO public.users (id, username, display_name, email, created_at, banned_at)
          VALUES (
            ${id}, ${uname}, ${`Bridge ${uname}`},
            ${`bridge_${uname}@verify.invalid`},
            ${id === young ? new Date() : oldCreatedAt},
            ${id === banned ? new Date() : null}
          )`;
      }

      await tx`
        INSERT INTO public.products (id, slug, maker_id, name, tagline, description, category, status, published_at, created_at, updated_at)
        VALUES
          (${productA},       ${`bridge-prod-${suffix}`},  ${maker}, 'Produit Bridge', 'pont 0055',  'Fiche de vérif du pont d''écriture directe.', 'apps', 'published', now(), now(), now()),
          (${productCurated}, ${`bridge-cur-${suffix}`},   ${maker}, 'Produit Bridge Curaté', 'veille', 'Fiche curatée (avis refusés, commentaires ouverts).', 'apps', 'published', now(), now(), now()),
          (${productDraft},   ${`bridge-draft-${suffix}`}, ${maker}, 'Produit Bridge Draft', 'brouillon', 'Fiche non publiée.', 'apps', 'draft', null, now(), now())`;
      await tx`UPDATE public.products SET curated = true WHERE id = ${productCurated}`;

      // ── identité JWT : exactement la surface PostgREST ────────────────
      let sp = 0;
      const asUser = async (uid: string | null): Promise<void> => {
        if (uid === null) {
          await tx.unsafe("RESET ROLE");
        } else {
          await tx.unsafe("RESET ROLE");
          await tx.unsafe("SET LOCAL ROLE authenticated");
          await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
            `{"sub": "${uid}", "role": "authenticated"}`,
          ]);
        }
      };
      // Refus isolé : savepoint + rollback dans les deux issues.
      const refused = async (fn: () => Promise<unknown>): Promise<PgErr> => {
        sp += 1;
        const name = `bridge_sp_${sp}`;
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
        name: string,
      ): Promise<void> => {
        const err = await refused(fn);
        check(name, err.detail?.includes(want) === true, { got: err.detail, want });
      };
      const hasCode = async (
        fn: () => Promise<unknown>,
        want: string,
        name: string,
      ): Promise<void> => {
        const err = await refused(fn);
        check(name, err.code === want, { got: err.code, want });
      };

      // ── 0. bridge_uuidv7 ───────────────────────────────────────────────
      const u7 = String((await tx`SELECT public.bridge_uuidv7() AS u`)[0].u);
      check("uuidv7 : version 7", u7[14] === "7", u7);
      check("uuidv7 : variant 10xx", "89ab".includes(u7[19]), u7);
      const v7b = String((await tx`SELECT public.bridge_uuidv7() AS u`)[0].u);
      check("uuidv7 : deux appels distincts", u7 !== v7b);

      // ── 1. anon : aucun droit d'écriture ───────────────────────────────
      await asUser(null);
      await tx.unsafe("SET LOCAL ROLE anon");
      await hasCode(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, 5, 'Essai anonyme du pont.')`,
        "42501",
        "anon : INSERT review refusé (42501)",
      );
      await asUser(tester);

      // ── 2. insertion légitime + compteurs + notif maker ────────────────
      await tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
               VALUES (${uuidv7()}, ${tester}, ${productA}, 5, 'Un avis positif du pont, au-dessus de dix caractères.')`;
      const stat =
        await tx`SELECT ratings_sum, ratings_count FROM public.products WHERE id = ${productA}`;
      check(
        "review : compteurs après insert (sum 5, count 1)",
        Number(stat[0].ratings_sum) === 5 && Number(stat[0].ratings_count) === 1,
        stat[0],
      );
      // Les notifs du maker ne sont PAS lisibles par le tester (RLS
      // own-row) : lecture en postgres (superuser), retour en tester.
      await asUser(null);
      const n1 = await tx`SELECT user_id, kind, title, actor_id FROM public.notifications
                          WHERE product_id = ${productA} ORDER BY created_at`;
      await asUser(tester);
      check(
        "review : notif maker exact (kind + titre + actor, pas self)",
        n1.length === 1 &&
          String(n1[0].user_id) === maker &&
          n1[0].kind === "review_received" &&
          n1[0].title === "Nouvel avis sur Produit Bridge (5/5)" &&
          String(n1[0].actor_id) === tester,
        n1,
      );

      // ── 3. édition : delta, pas de nouvelle notif ──────────────────────
      await tx`UPDATE public.reviews SET rating = 4, updated_at = now()
               WHERE user_id = ${tester} AND product_id = ${productA}`;
      const stat2 =
        await tx`SELECT ratings_sum, ratings_count FROM public.products WHERE id = ${productA}`;
      check(
        "review edit : delta (sum 4, count 1)",
        Number(stat2[0].ratings_sum) === 4 && Number(stat2[0].ratings_count) === 1,
        stat2[0],
      );
      await asUser(null);
      const n2 =
        await tx`SELECT count(*)::int AS c FROM public.notifications WHERE product_id = ${productA}`;
      await asUser(tester);
      check("review edit : pas de notif en plus", Number(n2[0].c) === 1, n2[0]);

      // ── 4. unicité 1 avis/personne/produit ─────────────────────────────
      await hasCode(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, 3, 'Second avis impossible du même auteur.')`,
        "23505",
        "review dup : unique violée (23505)",
      );

      // ── 5. soft delete auteur + reprise (UPDATE deleted_at) ────────────
      await tx`UPDATE public.reviews SET deleted_at = now()
               WHERE user_id = ${tester} AND product_id = ${productA}`;
      const stat3 =
        await tx`SELECT ratings_sum, ratings_count FROM public.products WHERE id = ${productA}`;
      check(
        "review delete : GREATEST décompte (sum 0, count 0)",
        Number(stat3[0].ratings_sum) === 0 && Number(stat3[0].ratings_count) === 0,
        stat3[0],
      );
      const ownDel =
        await tx`SELECT deleted_at FROM public.reviews WHERE user_id = ${tester} AND product_id = ${productA}`;
      check(
        "review supprimée : l'auteur la voit encore (select own)",
        ownDel.length === 1 && ownDel[0].deleted_at !== null,
        ownDel,
      );
      await tx`UPDATE public.reviews SET deleted_at = null, rating = 4
               WHERE user_id = ${tester} AND product_id = ${productA}`;
      const stat4 =
        await tx`SELECT ratings_sum, ratings_count FROM public.products WHERE id = ${productA}`;
      check(
        "review reprise : compteurs remontés (sum 4, count 1)",
        Number(stat4[0].ratings_sum) === 4 && Number(stat4[0].ratings_count) === 1,
        stat4[0],
      );

      // ── 6. compte jeune / banni ────────────────────────────────────────
      await asUser(young);
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${young}, ${productA}, 5, 'Avis d''un compte trop jeune pour l''auteur.')`,
        "account_too_young",
        "review jeune : refusé account_too_young",
      );
      await asUser(banned);
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${banned}, ${productA}, 5, 'Avis d''un compte suspendu.')`,
        "account_banned",
        "review banni : refusé account_banned",
      );

      // ── 7. bornes CHECK (note, corps) ──────────────────────────────────
      await asUser(tester);
      await hasCode(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, 6, 'Note hors borne visiblement.')`,
        "23514",
        "review : rating 6 refusé (CHECK)",
      );
      await hasCode(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, 5, 'court')`,
        "23514",
        "review : corps < 10 refusé (CHECK)",
      );

      // ── 8. produit draft / curaté (+ commentaires curaté OK) ───────────
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productDraft}, 4, 'Avis sur un brouillon interdit.')`,
        "product_not_published",
        "review draft : refusé product_not_published",
      );
      await hasDetail(
        () =>
          tx`INSERT INTO public.reviews (id, user_id, product_id, rating, body)
             VALUES (${uuidv7()}, ${tester}, ${productCurated}, 4, 'Avis sur une veille refusé.')`,
        "curated",
        "review curaté : refusé curated",
      );
      await tx`INSERT INTO public.comments (id, user_id, product_id, body)
               VALUES (${uuidv7()}, ${tester}, ${productCurated}, 'Commentaire sur veille autorisé.')`;
      check("comment curaté : autorisé", true);

      // ── 9. commentaires — notifs maker + parent ────────────────────────
      await asUser(parentAuthor);
      await tx`INSERT INTO public.comments (id, user_id, product_id, body)
               VALUES (${uuidv7()}, ${parentAuthor}, ${productA}, 'Commentaire racine du parent.')`;
      const rootId = String(
        (
          await tx`SELECT id FROM public.comments WHERE user_id = ${parentAuthor} AND product_id = ${productA} LIMIT 1`
        )[0].id,
      );
      await asUser(tester);
      const replyId = uuidv7();
      await tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
               VALUES (${replyId}, ${tester}, ${productA},
                       (SELECT id FROM public.comments WHERE user_id = ${parentAuthor} AND product_id = ${productA} LIMIT 1),
                       'Réponse légitime en un niveau.')`;
      const cstat = await tx`SELECT comments_count FROM public.products WHERE id = ${productA}`;
      check("comment : comments_count monté (2)", Number(cstat[0].comments_count) === 2, cstat[0]);
      // Les notifs du maker/parent ne sont PAS lisibles par le tester :
      // lecture en postgres, retour en tester pour la suite.
      await asUser(null);
      const cn = await tx`SELECT kind, count(*)::int AS c FROM public.notifications
                          WHERE product_id = ${productA}
                            AND kind IN ('comment_received', 'comment_replied')
                          GROUP BY kind ORDER BY kind`;
      check(
        "comment : notifs (comment_received ×2, comment_replied ×1)",
        cn.length === 2 &&
          cn.some((r) => r.kind === "comment_received" && Number(r.c) === 2) &&
          cn.some((r) => r.kind === "comment_replied" && Number(r.c) === 1),
        cn,
      );
      const prTitle =
        await tx`SELECT title FROM public.notifications WHERE kind = 'comment_replied' AND product_id = ${productA} LIMIT 1`;
      check(
        "comment : titre reply exact",
        prTitle.length === 1 &&
          prTitle[0].title === "Réponse à votre commentaire sur Produit Bridge",
        prTitle[0],
      );
      await asUser(tester);

      // ── 10. règles de parent + soft delete ─────────────────────────────
      await hasDetail(
        () =>
          tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, ${replyId}, 'Réponse de réponse refusée.')`,
        "reply_too_deep",
        "comment : reply-de-reply refusé",
      );
      await hasDetail(
        () =>
          tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
             VALUES (${uuidv7()}, ${tester}, ${productCurated},
                     (SELECT id FROM public.comments WHERE product_id = ${productA} LIMIT 1), 'Parent cross-produit.')`,
        "parent_not_found",
        "comment : parent cross-produit refusé",
      );
      await asUser(parentAuthor);
      await tx`UPDATE public.comments SET deleted_at = now()
               WHERE user_id = ${parentAuthor} AND product_id = ${productA}`;
      const cstat2 = await tx`SELECT comments_count FROM public.products WHERE id = ${productA}`;
      check(
        "comment soft-delete : GREATEST décompte (1)",
        Number(cstat2[0].comments_count) === 1,
        cstat2[0],
      );
      const ownDelC =
        await tx`SELECT deleted_at FROM public.comments WHERE user_id = ${parentAuthor} AND product_id = ${productA}`;
      check(
        "comment supprimé : l'auteur le voit encore (select own)",
        ownDelC.length === 1 && ownDelC[0].deleted_at !== null,
        ownDelC,
      );
      await asUser(tester);
      // parent_id = l'id EXPLICITE du commentaire supprimé (une
      // sous-requête par user/produit ne trouverait rien une fois le
      // parent soft-supprimé — le test passerait à tort en racine).
      await hasDetail(
        () =>
          tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, ${rootId},
                     'Réponse sur parent supprimé.')`,
        "parent_not_found",
        "comment : parent supprimé refusé",
      );
      // 0061 : un parent qui n'existe PAS DU TOUT (id aléatoire, sous la
      // main du caller) est refusé — la garde positive couvre l'état
      // historique : les deux IF EXISTS négatifs (supprimé/autre produit)
      // laissaient passer cette orpheline directe.
      await hasDetail(
        () =>
          tx`INSERT INTO public.comments (id, user_id, product_id, parent_id, body)
             VALUES (${uuidv7()}, ${tester}, ${productA}, ${uuidv7()}, 'Réponse orpheline directe.')`,
        "parent_not_found",
        "comment : parent inexistant refusé (orpheline directe, 0061)",
      );

      // ── 11. votes commentaires (score par RECOMPTE) ────────────────────
      const myComment = String(
        (
          await tx`SELECT id FROM public.comments WHERE user_id = ${tester} AND product_id = ${productA} LIMIT 1`
        )[0].id,
      );
      await tx`INSERT INTO public.comment_votes (id, user_id, comment_id, value)
               VALUES (${uuidv7()}, ${tester}, ${myComment}, 'up')`;
      let sc = (await tx`SELECT score FROM public.comments WHERE id = ${myComment}`)[0];
      check("comment vote up : score 1", Number(sc.score) === 1, sc);
      await tx`UPDATE public.comment_votes SET value = 'down'
               WHERE user_id = ${tester} AND comment_id = ${myComment}`;
      sc = (await tx`SELECT score FROM public.comments WHERE id = ${myComment}`)[0];
      check("comment vote flipped : score -1", Number(sc.score) === -1, sc);
      await tx`DELETE FROM public.comment_votes WHERE user_id = ${tester} AND comment_id = ${myComment}`;
      sc = (await tx`SELECT score FROM public.comments WHERE id = ${myComment}`)[0];
      check("comment vote withdrawn : score 0", Number(sc.score) === 0, sc);
      await hasCode(
        () =>
          tx`INSERT INTO public.comment_votes (id, user_id, comment_id, value)
             VALUES (${uuidv7()}, ${tester}, ${myComment}, 'up'), (${uuidv7()}, ${tester}, ${myComment}, 'down')`,
        "23505",
        "comment vote : un seul vote/personne (23505)",
      );
      // Le mobile ne peut JAMAIS hard-delete : aucun grant DELETE sur
      // reviews (et aucune policy DELETE) — l'API refuse avant même le RLS.
      await hasCode(
        () => tx`DELETE FROM public.reviews WHERE user_id = ${maker}`,
        "42501",
        "review : DELETE non accordé (42501)",
      );
      const foreignUpd =
        await tx`UPDATE public.reviews SET deleted_at = now() WHERE user_id = ${maker} AND product_id = ${productA}`;
      check(
        "review d'autrui : UPDATE policy → 0 ligne",
        Number(foreignUpd.count) === 0,
        foreignUpd.count,
      );

      // ── 12. notifications : JAMAIS l'écriture directe ──────────────────
      await hasCode(
        () =>
          tx`INSERT INTO public.notifications (id, user_id, kind, title)
             VALUES (${uuidv7()}, ${tester}, 'review_received', 'Forger une notif.')`,
        "42501",
        "notifications : INSERT refusé",
      );

      // ── 13. produits : aucune écriture directe JWT ─────────────────────
      await hasCode(
        () =>
          tx`UPDATE public.products SET upvote_count = upvote_count + 100 WHERE id = ${productA}`,
        "42501",
        "products : UPDATE auth refusé (42501)",
      );

      // ── 14. flood 20 écritures / 60 s ──────────────────────────────────
      // Tester a déjà 2 commentaires dans la fenêtre (veille + réponse).
      // Miroir Upstash (max 20) : 18 inserts passent encore, le 19e refusé.
      let flooded = 0;
      for (let i = 0; i < 25; i += 1) {
        try {
          await tx`INSERT INTO public.comments (id, user_id, product_id, body)
                   VALUES (${uuidv7()}, ${tester}, ${productA}, ${`Flood ${i}.`})`;
          flooded = i + 1;
        } catch (e) {
          const err = e as PgErr;
          check(
            "flood : refus après 20 écritures (2 déjà + 18 ici)",
            err.detail?.includes("flood") === true && flooded === 18,
            { detail: err.detail, flooded, i },
          );
          break;
        }
      }

      // Fin de fenêtre : si le garde n'a JAMAIS refusé (boucle achevée
      // sans exception), l'assertion suivante rate le compte attendu.
      check("flood : seuil atteint (19e écriture refusée)", flooded === 18, flooded);

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

  console.log(`mobile-direct: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-mobile-direct échoué:", e);
  process.exit(1);
});
