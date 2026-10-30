/**
 * Vérif 0059 — pont direct PostgREST pour `notifications.read_at`
 * (demande squad mobile, suite 0055).
 *
 * Le contrat mobile : `update({'read_at'}).eq('id', X).eq('user_id', moi)`
 * en direct (médiation Dart déjà écrite — fallback PATCH API temporaire).
 * Ce que ça prouve :
 *
 * 1. l'état RLS est complet ET autoportant : la policy SELECT own ne
 *    vivait JUSQU'ICI que dans setup.sql — une base n'ayant suivi que
 *    les migrations laissait notifications SANS RLS avec le GRANT SELECT
 *    de 0055 : toute ligne lisible par tout authenticated (fuite réelle).
 *    Ici, RLS enable + select_own + update_own sont posés par 0059 ;
 * 2. la surface d'écriture est au millimètre : UPDATE(read_at) SEULE —
 *    title/user_id/created_at/… refusés (42501), INSERT + DELETE fermés
 *    (42501) ; le destinataire ne peut pas être modifié ;
 * 3. l'isolation est MUTUELLE : chaque authenticated ne voit et n'écrit
 *    QUE ses lignes (SELECT sans filtre = ses lignes seules ; update sur
 *    autrui = 0 ligne, et silencieux comme le RLS postgrest l'impose) ;
 * 4. l'écriture contractuelle fonctionne : read_at marque le lu,
 *    RowCount 1 exactement, lisible immédiatement après.
 *
 * Mécanique : TOUT vit dans une transaction annulée en fin par un throw
 * volontaire (pattern 0057 — aucun COMMIT, fixtures et sondes annihilées).
 * L'identité PostgREST est simulée exactement : SET LOCAL ROLE
 * authenticated + request.jwt.claims du sub.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0059-notifications-read-at-pont.ts`
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
  const ownerErrMessage = "rollback volontaire — aucun résidu";

  try {
    await sql.begin(async (tx) => {
      // ── fixtures CPU : deux makers, une notification chacun ───────────
      const me = uuidv7();
      const other = uuidv7();
      const oldCreatedAt = new Date(Date.now() - 2 * 3_600_000);
      for (const [id, uname] of [
        [me, `n_read_me_${suffix}`],
        [other, `n_read_other_${suffix}`],
      ] as const) {
        await tx`
          INSERT INTO public.users (id, username, display_name, email, created_at)
          VALUES (${id}, ${uname}, ${`${uname} verify`}, ${`${uname}@verify.invalid`}, ${oldCreatedAt})`;
      }
      // Pas de défaut sur id (UUIDv7 décisionnel : curseur temporel) —
      // on fournit, comme le service.
      const notifMe = uuidv7();
      const notifOther = uuidv7();
      await tx`
        INSERT INTO public.notifications (id, user_id, kind, title)
        VALUES
          (${notifMe},    ${me},    'role_changed',  'Pont 0059 : votre notification (soi)'),
          (${notifOther}, ${other}, 'legal_updated', 'Pont 0059 : notification (autrui)')`;

      // ── identité JWT : exactement la surface PostgREST ────────────────
      let sp = 0;
      const asUser = async (uid: string): Promise<void> => {
        await tx.unsafe("RESET ROLE");
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
          `{"sub": "${uid}", "role": "authenticated"}`,
        ]);
      };
      // Refus isolé : savepoint + rollback dans les deux issues.
      const refused = async (fn: () => Promise<unknown>): Promise<PgErr> => {
        sp += 1;
        const name = `n59_sp_${sp}`;
        await tx.unsafe(`SAVEPOINT ${name}`);
        try {
          await fn();
          await tx.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
          return { detail: "PASSE À TORT (attendu refus)", code: "ok" };
        } catch (e) {
          await tx.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
          return e as PgErr;
        }
      };

      // ── 0. état RLS (catalog) — autoportant, pas dépendant setup.sql ──
      await tx.unsafe("RESET ROLE");
      const [rls] = await tx`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE oid = 'public.notifications'::regclass`;
      check("RLS activé sur notifications (relrowsecurity)", rls?.relrowsecurity === true, rls);
      const policies = await tx`
        SELECT polname
        FROM pg_policy
        WHERE polrelid = 'public.notifications'::regclass`;
      const polNames = policies.map((p) => p.polname).sort();
      check(
        "policies select_own + update_own présentes (suivi migrations seul)",
        polNames.includes("notifications_select_own") &&
          polNames.includes("notifications_update_own"),
        polNames,
      );
      // Policy UPDATE : structurelle (polcmd 'w' = UPDATE, rôles) —
      // l'arbitrage de l'identité (USING/WITH CHECK) est prouvé
      // COMPORTEMENTALEMENT ci-dessous (selects isolés, cross = 0 ligne).
      const [updPol] = await tx`
        SELECT polcmd, polroles
        FROM pg_policy
        WHERE polrelid = 'public.notifications'::regclass AND polname = 'notifications_update_own'`;
      const [authRole] = await tx`SELECT oid FROM pg_roles WHERE rolname = 'authenticated'`;
      check(
        "update_own : policy UPDATE pour authenticated (polcmd w)",
        updPol?.polcmd === "w" &&
          (updPol?.polroles ?? []).map(String).includes(String(authRole?.oid)),
        { updPol, authRole },
      );
      // Grant de colonnes : read_at seule en UPDATE.
      const cols: Array<[string, boolean]> = [
        ["read_at", true],
        ["id", false],
        ["user_id", false],
        ["kind", false],
        ["product_id", false],
        ["actor_id", false],
        ["title", false],
        ["body", false],
        ["created_at", false],
      ];
      for (const [col, want] of cols) {
        const [p] = await tx`
          SELECT pg_catalog.has_column_privilege('authenticated', 'public.notifications', ${col}, 'UPDATE') AS ok`;
        check(
          want ? `UPDATE grant : ${col} autorisée` : `UPDATE grant : ${col} fermée`,
          Boolean(p?.ok) === want,
          { col, got: p?.ok, want },
        );
      }
      const [anonPriv] = await tx`
        SELECT
          pg_catalog.has_table_privilege('anon', 'public.notifications', 'SELECT') AS sel,
          pg_catalog.has_table_privilege('anon', 'public.notifications', 'UPDATE') AS upd`;
      check(
        "anon : ni SELECT ni UPDATE (REVOKE ALL conservé)",
        !anonPriv?.sel && !anonPriv?.upd,
        anonPriv,
      );

      // ── 1. isolation SELECT mutuelle ──────────────────────────────────
      await asUser(me);
      const mine = await tx`SELECT id FROM public.notifications`;
      check(
        "select sans filtre : JE NE vois que mes lignes (1/2)",
        mine.length === 1 && String(mine[0].id) === notifMe,
        mine.map((r) => r.id),
      );
      await asUser(other);
      const theirs = await tx`SELECT id FROM public.notifications`;
      check(
        "select sans filtre : AUTRUI ne voit que ses lignes (isolation mutuelle)",
        theirs.length === 1 && String(theirs[0].id) === notifOther,
        theirs.map((r) => r.id),
      );

      // ── 2. l'écriture contractuelle : read_at, propre ligne ───────────
      await asUser(me);
      const marked = await tx`
        UPDATE public.notifications SET read_at = now()
        WHERE id = ${notifMe} AND user_id = ${me}
        RETURNING id, read_at`;
      check("mark lu : UPDATE own passe, exactement 1 ligne", marked.length === 1, marked);
      const readBack = await tx`
        SELECT read_at FROM public.notifications WHERE id = ${notifMe}`;
      check("relire après coup : read_at présent", readBack[0]?.read_at !== null, readBack);
      const probeReadAt = readBack[0]?.read_at as string | null;

      // ── 3. sur autrui : 0 ligne, silencieux (RLS) ─────────────────────
      await asUser(other);
      const cross = await tx`
        UPDATE public.notifications SET read_at = clock_timestamp()
        WHERE id = ${notifMe} AND user_id = ${me}
        RETURNING id`;
      check("update cross-user : 0 ligne, sans erreur (le RLS filtre)", cross.length === 0, cross);
      await asUser(me);
      const afterCross = await tx`
        SELECT read_at FROM public.notifications WHERE id = ${notifMe}`;
      check(
        "update cross-user : la ligne du maker est intouchée (read_at inchangé)",
        afterCross[0]?.read_at !== null &&
          new Date(probeReadAt ?? 0).getTime() === new Date(afterCross[0]?.read_at ?? 0).getTime(),
        { probeReadAt, afterCross: afterCross[0]?.read_at },
      );

      // ── 4. hors surface : 42501 durs, savepoint isolés ────────────────
      await asUser(me);
      const insertErr = await refused(async () => {
        await tx`
          INSERT INTO public.notifications (id, user_id, kind, title)
          VALUES (${uuidv7()}, ${me}, 'banned', 'Injection par le client')`;
      });
      check(
        "INSERT : refusé (les notifs naissent des triggers/service)",
        insertErr.code === "42501",
        insertErr,
      );
      const deleteErr = await refused(async () => {
        await tx`DELETE FROM public.notifications WHERE id = ${notifMe}`;
      });
      check(
        "DELETE : refusé (aucune suppression côté client)",
        deleteErr.code === "42501",
        deleteErr,
      );
      const titleErr = await refused(async () => {
        await tx`
          UPDATE public.notifications SET title = 'Falsifié'
          WHERE id = ${notifMe} AND user_id = ${me}`;
      });
      check("UPDATE title : refus (hors grant de colonnes)", titleErr.code === "42501", titleErr);
      const reassignErr = await refused(async () => {
        await tx`
          UPDATE public.notifications SET user_id = ${other}
          WHERE id = ${notifMe} AND user_id = ${me}`;
      });
      check(
        "UPDATE user_id : refus (le destinataire n'est jamais modifiable)",
        reassignErr.code === "42501",
        reassignErr,
      );
      const createdErr = await refused(async () => {
        await tx`
          UPDATE public.notifications SET created_at = now()
          WHERE id = ${notifMe} AND user_id = ${me}`;
      });
      check(
        "UPDATE created_at : refus (horodatages immuables côté client)",
        createdErr.code === "42501",
        createdErr,
      );

      throw new Error(ownerErrMessage);
    });
    await sql.end();
  } catch (e) {
    // Rollback volontaire = succès ; tout autre throw remonte.
    if (!(e instanceof Error) || e.message !== ownerErrMessage) throw e;
  }

  console.log(`\nnotifications.read_at pont 0059 : ${pass} ok, ${fail} KO`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify-0059 crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
