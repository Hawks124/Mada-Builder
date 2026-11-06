/**
 * Vérif 0065 — parité FCM avec la squad mobile + durcissement
 * `user_devices`. Le lot lie les deux vérités sur la base partagée :
 * la table et ses colonnes de contrat existent DANS notre chaîne
 * Drizzle (mort du drift `generate`), les durcissements arbitrés sont
 * posés (policy UPDATE, revokes, index dupliqué, prototype pg_net
 * mort, cron de purge) et le canal est réellement armé (Webhook →
 * Edge Function `send-push`, secret Firebase présent).
 *
 * Mécanique : TOUT dans UNE transaction annulée en fin par un throw
 * volontaire (aucun résidu) ; SET LOCAL ROLE + claims JWT locaux
 * reproduisent exactement ce que PostgREST voit pour anon /
 * authenticated ; les erreurs attendues vivent dans des SAVEPOINT
 * isolés. Les assertions de catalogue (policies, grants, triggers,
 * index, cron) sont des lectures — zéro mutation par défaut. Parler à
 * Postgres se fait en tagged templates (convention de la maison,
 * verify-0064) ; les seuls `unsafe` tolérés portent des noms de
 * SAVEPOINT issus de constantes littérales du présent fichier.
 *
 * Ce que ça prouve (après application de 0065) :
 * - `user_devices` : 11 colonnes (les 8 réelles de prod + les 3
 *   métadonnées du contrat déclaré de la squad mobile), contraintes
 *   `user_devices_fcm_token_key` UNIQUE + CHECK platform, un seul
 *   index du token (le dupliqué mobile `idx_user_devices_token`
 *   tombé ; `idx_user_devices_user_id`, non arbitré, laissé intact) ;
 * - `notifications` : `meta` + `fcm_dispatched_at` posées (contrat
 *   push), l'index unique milestones 0028 intact (titre gélé) ;
 * - policies : SELECT/DELETE own pour authenticated, INSERT (anon +
 *   authenticated) user_id NULL ou self, UPDATE corrigé (fin du
 *   `USING (true)` — cibler autre chose que SES lignes ou les lignes
 *   anonymes est mort ; possédé → NULL impossible) ;
 * - grants normalisés : anon → INSERT, UPDATE uniquement ;
 *   authenticated → SELECT, INSERT, UPDATE, DELETE (ni TRUNCATE, ni
 *   REFERENCES, ni TRIGGER) ;
 * - `tr_notification_created_fcm` et `handle_notification_created_fcm`
 *   ABSENTS (arbitrage point 3) ; le Webhook natif
 *   `send_push_on_notification` toujours là et pointant send-push ;
 * - le canal est ARMÉ : l'Edge Function répond 400 sur un corps vide
 *   (passe l'auth, meurt sur la validation du record) — preuve EF
 *   vivante + secret Firebase OK, sans toucher de données ;
 * - cron `purge-anon-devices` posé (tempo 30 j, arbitrage point 11).
 *
 * Relance :
 * `VERIFY_ALLOW_PROD=1 node node_modules/tsx/dist/cli.mjs scripts/verify-0065-fcm-push-parity-web.ts`
 */
import "./_env";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";

let pass = 0;
let fail = 0;
/** Enregistre une assertion : incrémente `pass`/`fail` et journalise le
 * résultat (console : `ok:` en vert, `KO:` + détail JSON en erreur). */
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    pass += 1;
    console.log(`  ok: ${name}`);
  } else {
    fail += 1;
    console.error(`  KO: ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** Erreurs attendues : Postgres expose le SQLSTATE dans `code`. */
type PgErr = { code?: string };

/**
 * Point d'entrée du verify 0065 : sonde HTTP du canal (section 0),
 * lectures de catalogue (section 1), comportements RLS dans une
 * transaction annulée (section 2), état du cron de purge (section 3).
 * Sortie : code 0 si toutes les assertions passent, 1 sinon.
 */
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

  // ── 0. Canal armé (hors transaction : sonde HTTP) ───────────────────
  // Un POST sans payload valide passe l'auth + le check secret Firebase,
  // puis meurt sur la validation du record — 400 « Invalid notification
  // record » = EF vivante + secret présent. Toute autre réponse = le
  // pipeline est à re-sonder.
  const efUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (efUrl && svcKey) {
    let armed = false;
    let detail = "";
    try {
      const r = await fetch(`${efUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${svcKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      armed = r.status === 400 && (body.error ?? "").includes("Invalid notification record");
      detail = `status=${r.status} body=${JSON.stringify(body).slice(0, 120)}`;
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e);
    }
    check("canal armé : EF send-push vivante + secret Firebase OK", armed, detail);
  } else {
    console.log("  skip : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absentes — sonde EF hors lot");
  }

  // ── 1. Catalogue — lectures pures ───────────────────────────────────
  const deviceRows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_devices'
    ORDER BY ordinal_position`;
  const deviceCols = deviceRows.map((c) => String(c.column_name)).sort();
  check(
    "user_devices : 11 colonnes (prod réelle + métadonnées du contrat déclaré)",
    JSON.stringify(deviceCols) ===
      JSON.stringify([
        "app_version",
        "created_at",
        "device_model",
        "fcm_token",
        "id",
        "is_active",
        "last_seen_at",
        "os_version",
        "platform",
        "updated_at",
        "user_id",
      ]),
    deviceCols,
  );

  const notifRows = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
      AND column_name IN ('meta', 'fcm_dispatched_at')`;
  const meta = notifRows.find((c) => String(c.column_name) === "meta");
  const disp = notifRows.find((c) => String(c.column_name) === "fcm_dispatched_at");
  check(
    "notifications : meta jsonb NOT NULL DEFAULT '{}' + fcm_dispatched_at timestamptz",
    !!meta &&
      String(meta.data_type) === "jsonb" &&
      String(meta.is_nullable) === "NO" &&
      String(meta.column_default) === "'{}'::jsonb" &&
      !!disp &&
      String(disp.data_type) === "timestamp with time zone" &&
      String(disp.is_nullable) === "YES",
    notifRows,
  );

  const idxRows = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'user_devices'`;
  const tokenIdx = idxRows.filter((i) => /fcm_token/i.test(String(i.indexdef)));
  check(
    "fcm_token : UN SEUL index (la contrainte inline unique)",
    tokenIdx.length === 1 && String(tokenIdx[0]?.indexname) === "user_devices_fcm_token_key",
    tokenIdx.map((i) => String(i.indexname)),
  );
  check(
    "idx_user_devices_token : tombé (dup mobile retiré, arbitrage point 8)",
    !idxRows.some((i) => String(i.indexname) === "idx_user_devices_token"),
    idxRows.map((i) => String(i.indexname)),
  );
  check(
    "idx_user_devices_user_id : intact (index mobile non arbitré — jamais touché par 0065)",
    idxRows.some((i) => String(i.indexname) === "idx_user_devices_user_id"),
    idxRows.map((i) => String(i.indexname)),
  );
  check(
    "idx_user_devices_lookup : partiel (is_active AND user_id NOT NULL)",
    idxRows.some(
      (i) =>
        String(i.indexname) === "idx_user_devices_lookup" &&
        /WHERE \(\(is_active = true\) AND \(user_id IS NOT NULL\)\)/.test(String(i.indexdef)),
    ),
    idxRows.map((i) => String(i.indexname)),
  );

  const [rlsRow] = await sql`
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_devices'::regclass`;
  check("user_devices : RLS enabled", rlsRow?.relrowsecurity === true, rlsRow);

  const polRows = await sql`
    SELECT p.polname, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS chk,
           (SELECT array_agg(pg_get_userbyid(rr)) FROM unnest(p.polroles) rr) AS roles
    FROM pg_policy p
    WHERE p.polrelid = 'public.user_devices'::regclass
    ORDER BY p.polname`;
  /** Trouve une policy par son nom dans les rows lues de `pg_policy`. */
  const byName = (n: string) => polRows.find((p) => String(p.polname) === n);
  /** Extrait la liste des rôles d'une row policy (`polroles` → noms). */
  const rolesOf = (r: { roles: unknown }) =>
    Array.isArray(r.roles) ? r.roles.map((x) => String(x)) : [];

  const sel = byName("user_devices_select_policy");
  check(
    "policy SELECT : authenticated, own (user_id = auth.uid())",
    String(sel?.polcmd) === "r" &&
      JSON.stringify(rolesOf({ roles: sel?.roles ?? null })) ===
        JSON.stringify(["authenticated"]) &&
      String(sel?.qual) === "(user_id = auth.uid())",
    sel,
  );
  const ins = byName("user_devices_insert_policy");
  check(
    "policy INSERT : anon + authenticated, user_id NULL ou self (WITH CHECK)",
    String(ins?.polcmd) === "a" &&
      JSON.stringify(rolesOf({ roles: ins?.roles ?? null }).sort()) ===
        JSON.stringify(["anon", "authenticated"]) &&
      String(ins?.chk) === "((user_id IS NULL) OR (user_id = auth.uid()))",
    ins,
  );
  const upd = byName("user_devices_update_policy");
  check(
    "policy UPDATE : anon + authenticated, fin du USING(true)",
    String(upd?.polcmd) === "w" &&
      rolesOf({ roles: upd?.roles ?? null }).includes("anon") &&
      rolesOf({ roles: upd?.roles ?? null }).includes("authenticated") &&
      String(upd?.qual).includes("auth.uid()") &&
      String(upd?.qual).includes("user_id IS NULL") &&
      String(upd?.qual) !== "true",
    upd,
  );
  check(
    "policy UPDATE : le CHECK refuse possédé → NULL (l'attaque de dissociation est morte)",
    String(upd?.chk).includes("user_id IS NULL") &&
      String(upd?.chk).includes("user_id = auth.uid()") &&
      String(upd?.chk).includes("auth.uid() IS NULL"),
    upd?.chk,
  );
  const del = byName("user_devices_delete_policy");
  check(
    "policy DELETE : authenticated, own",
    String(del?.polcmd) === "d" &&
      JSON.stringify(rolesOf({ roles: del?.roles ?? null })) ===
        JSON.stringify(["authenticated"]) &&
      String(del?.qual) === "(user_id = auth.uid())",
    del,
  );

  const grantRows = await sql`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'user_devices'
      AND grantee IN ('anon', 'authenticated')
    ORDER BY grantee, privilege_type`;
  const grantsOf = (g: string) =>
    grantRows.filter((r) => String(r.grantee) === g).map((r) => String(r.privilege_type));
  check(
    "anon : grants normalisés à INSERT, UPDATE (SELECT jamais lisible, ni DELETE/TRUNCATE/REFERENCES/TRIGGER)",
    JSON.stringify(grantsOf("anon")) === JSON.stringify(["INSERT", "UPDATE"]),
    grantsOf("anon"),
  );
  check(
    "authenticated : grants normalisés à SELECT, INSERT, UPDATE, DELETE (ni TRUNCATE, ni REFERENCES, ni TRIGGER)",
    JSON.stringify(grantsOf("authenticated")) ===
      JSON.stringify(["DELETE", "INSERT", "SELECT", "UPDATE"]),
    grantsOf("authenticated"),
  );

  const trigDevices = await sql`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.user_devices'::regclass AND NOT tgisinternal`;
  check(
    "tr_user_device_updated_at : présent (horodatage contrat mobile)",
    trigDevices.some((t) => String(t.tgname) === "tr_user_device_updated_at"),
    trigDevices.map((t) => String(t.tgname)),
  );

  const trigNotifs = await sql`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass AND NOT tgisinternal`;
  check(
    "notifications : prototype pg_net tombé (dispatch = Webhook natif exclusif, arbitrage point 3)",
    !trigNotifs.some((t) => String(t.tgname) === "tr_notification_created_fcm"),
    trigNotifs.map((t) => String(t.tgname)),
  );
  const [fnGone] = await sql`
    SELECT count(*)::int AS c FROM pg_proc WHERE proname = 'handle_notification_created_fcm'`;
  check("handle_notification_created_fcm : absente du catalogue", Number(fnGone?.c ?? 0) === 0);

  const [hook] = await sql`
    SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass
      AND tgname = 'send_push_on_notification' AND NOT tgisinternal`;
  check(
    "Webhook send_push_on_notification : INTACT et pointant send-push",
    String(hook?.def ?? "").includes("/functions/v1/send-push"),
    String(hook?.def ?? "").slice(0, 120),
  );

  const [purgeFn] = await sql`
    SELECT count(*)::int AS c FROM pg_proc WHERE proname = 'purge_anon_devices'`.catch(() => [
    { c: 0 },
  ]);
  check("purge_anon_devices() : posée", Number(purgeFn?.c ?? 0) === 1);

  const [purgeAcl] = await sql`
    SELECT proacl FROM pg_proc WHERE proname = 'purge_anon_devices'`;
  const aclItems = Array.isArray(purgeAcl?.proacl) ? purgeAcl.proacl.map((a) => String(a)) : [];
  check(
    "purge_anon_devices() : EXECUTE révoqué à PUBLIC/anon/authenticated (owner + service_role conservés)",
    aclItems.length > 0 &&
      !aclItems.some((a) => /^(=|anon=|authenticated=)/.test(a)) &&
      aclItems.some((a) => /^postgres=X/i.test(a)) &&
      aclItems.some((a) => /^service_role=X/i.test(a)),
    aclItems,
  );

  const [uidx] = await sql`
    SELECT count(*)::int AS c FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'notifications_milestone_uidx'`;
  check(
    "notifications_milestone_uidx (0028) : intact — contrat de titre gélé",
    Number(uidx?.c ?? 0) === 1,
  );

  // ── 2. Comportements RLS (transaction annulée en fin) ───────────────
  let fixturesPosed = false;
  await sql
    .begin(async (tx) => {
      const impossible = async (): Promise<never> => {
        throw new Error("rollback volontaire (fin de verify-0065 — aucun résidu)");
      };

      /** Éprouvette : SAVEPOINT → tentative → SQLSTATE capté → rollback.
       * Les noms viennent de constantes locales — aucun des deux unsafe
       * n'interpole de valeur extérieure. */
      const expectViolation = async (
        sp: string,
        attempt: () => Promise<string | undefined>,
      ): Promise<string | undefined> => {
        await tx.unsafe(`SAVEPOINT ${sp}`);
        let code: string | undefined;
        try {
          code = await attempt();
        } catch (e) {
          code = (e as PgErr).code ?? "no_code";
        } finally {
          await tx.unsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
        }
        return code;
      };

      // Fixtures : m1 et m2 (makers), dM1/dM2 (devices possédées), dAnon
      // (device anonyme du flow splashscreen, user_id NULL).
      const m1 = uuidv7();
      const m2 = uuidv7();
      const dAnon = uuidv7();
      const dM1 = uuidv7();
      const dM2 = uuidv7();
      for (const [id, uname] of [
        [m1, `g65_m1_${suffix}`] as const,
        [m2, `g65_m2_${suffix}`] as const,
      ]) {
        await tx`
          INSERT INTO public.users (id, username, display_name, email)
          VALUES (${id}, ${uname}, ${"Vérif 0065"}, ${`${uname}@probe.local`})`;
      }
      await tx`
        INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
        VALUES
          (${dM1}, ${m1}, ${`g65_tok_${suffix}1`}, 'android'),
          (${dM2}, ${m2}, ${`g65_tok_${suffix}2`}, 'ios')`;
      await tx`
        INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
        VALUES (${dAnon}, NULL, ${`g65_tok_${suffix}3`}, 'android')`;
      fixturesPosed = true;
      const [seen] = await tx`
        SELECT id::text AS id FROM public.users WHERE id = ${m1}`;
      check("fixtures users/devices posés (tout est annulé en fin de verify)", Boolean(seen?.id));

      // ── En tant qu'anon (le client PostgREST sans compte) ──────────
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ role: "anon" })}, true)`;
      await tx`SET LOCAL ROLE anon`;

      // SELECT du token : 42501 — les tokens FCM sont des secrets de
      // transport. Le SELECT colonnes anon est scoped à (id, user_id),
      // strictement pour l'évaluation des policies ; sans policy SELECT
      // pour anon, aucune row n'est de toute façon lisible.
      const selAnon = await expectViolation("sp_anon_select_token", () =>
        tx`SELECT fcm_token FROM public.user_devices`.then(() => undefined),
      );
      check("anon SELECT fcm_token : 42501 (tokens jamais lisibles)", selAnon === "42501", selAnon);

      // INSERT de SA device anonyme : passe (flow splashscreen).
      const insAnon = await tx`
        INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
        VALUES (${uuidv7()}, NULL, ${`g65_tok_${suffix}4`}, 'android')`;
      check(
        "anon INSERT device anonyme : 1 row (le flow splashscreen vit)",
        insAnon.count === 1,
        insAnon.count,
      );

      // INSERT en usurpant m1 : 42501 — l'anon ne peut PAS rattacher un
      // device à un compte existant.
      const insUsurp = await expectViolation("sp_anon_usurp", () =>
        tx`
          INSERT INTO public.user_devices (id, user_id, fcm_token, platform)
          VALUES (${uuidv7()}, ${m1}, ${`g65_tok_${suffix}5`}, 'ios')`.then(() => undefined),
      );
      check(
        "anon INSERT user_id = m1 : 42501 (pas d'usurpation de rattachement)",
        insUsurp === "42501",
        insUsurp,
      );

      // UPDATE de la device D'AUTRUI : 0 rows — USING ne la voit plus.
      const updAutrui = await tx`
        UPDATE public.user_devices SET is_active = false WHERE id = ${dM1}`;
      check(
        "anon UPDATE device de m1 : 0 rows (fin du USING(true))",
        updAutrui.count === 0,
        updAutrui.count,
      );

      // UPDATE même de SA row anonyme : 0 rows. Postgres exige la
      // SELECT-visibilité de la row pour toute UPDATE — anon n'a
      // AUCUNE policy SELECT (sinon les tokens seraient lisibles), donc
      // une UPDATE anonyme directe est muette. Comportement IDENTIQUE
      // en prod pré-0065 (policy SELECT own-only depuis leur chaîne) :
      // zéro régression ; le renouvellement de token anonyme passe par
      // une INSERT au relancement, jamais par un UPDATE direct.
      const updSienneAnon = await tx`
        UPDATE public.user_devices SET is_active = false WHERE id = ${dAnon}`;
      check(
        "anon UPDATE sa device anonyme : 0 rows (visibilité SELECT requise muet — réalité RLS symétrique pré-0065)",
        updSienneAnon.count === 0,
        updSienneAnon.count,
      );

      // DELETE : 42501 — grant retiré (ni ses rows, ni celles d'autrui).
      const delAnon = await expectViolation("sp_anon_delete", () =>
        tx`DELETE FROM public.user_devices WHERE id = ${dAnon}`.then(() => undefined),
      );
      check("anon DELETE : 42501 (grant retiré)", delAnon === "42501", delAnon);

      // ── En tant que m2 (authenticated, un AUTRE utilisateur) ───────
      await tx`RESET ROLE`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ role: "authenticated", sub: m2, aud: "authenticated" })}, true)`;
      await tx`SET LOCAL ROLE authenticated`;

      // UPDATE de la device de m1 : 0 rows (l'attaque DoS du ticket est morte).
      const m2Autrui = await tx`
        UPDATE public.user_devices SET is_active = false WHERE id = ${dM1}`;
      check("m2 UPDATE device de m1 : 0 rows (zéro oracle)", m2Autrui.count === 0, m2Autrui.count);

      // Contrôle positif : la SIENNE passe.
      const m2Sienne = await tx`
        UPDATE public.user_devices SET is_active = false WHERE id = ${dM2}`;
      check("m2 UPDATE sa device : 1 row (contrôle positif)", m2Sienne.count === 1, m2Sienne.count);

      // La réclamation anonyme → compte : IMPOSSIBLE en UPDATE direct.
      // Postgres exige la SELECT-visibilité de la row pour une UPDATE —
      // la policy SELECT est own-only (sinon tout compte lisait les
      // TOKENS des devices anonymes d'autrui — leak des secrets de
      // transport). La réclamation passe par l'Edge Function
      // (service_role, hors RLS) — c'est fait exprès : l'arbitrage
      // garde ici une protection franche.
      const claimDirect = await tx`
        UPDATE public.user_devices SET user_id = ${m2} WHERE id = ${dAnon}`;
      check(
        "claim anonyme en UPDATE direct : 0 rows (row invisible pour tout rôle client — la voie reste l'EF service_role)",
        claimDirect.count === 0,
        claimDirect.count,
      );

      // Dissociation d'une device POSÉDÉE :
      // 1) SA device : la row est visible (own), l'UPDATE est bloquée par
      //    le CHECK arbitré — 42501 franchement (l'écriture post-modif
      //    de user_id → NULL est refusée par WITH CHECK).
      const dissOwn = await expectViolation("sp_dissociate_own", () =>
        tx`UPDATE public.user_devices SET user_id = NULL WHERE id = ${dM2}`.then(() => undefined),
      );
      check(
        "possédé (sien) → NULL : 42501 (CHECK anti-DoS, arbitrage point 4)",
        dissOwn === "42501",
        dissOwn,
      );
      // 2) La device d'AUTRUI : invisible (policy SELECT own) → 0 rows —
      //    l'attaque DoS du ticket meurt AVANT l'écriture.
      const dissAutrui = await tx`
        UPDATE public.user_devices SET user_id = NULL WHERE id = ${dM1}`;
      check(
        "possédé (autrui) → NULL : 0 rows (la row n'est même pas atteinte)",
        dissAutrui.count === 0,
        dissAutrui.count,
      );

      await impossible();
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (fixturesPosed && msg.includes("rollback volontaire")) return;
      throw e;
    });

  // ── 3. Cron de purge ────────────────────────────────────────────────
  let cronOk = false;
  let cronDetail: unknown;
  try {
    const [job] = await sql`
      SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'purge-anon-devices'`;
    cronOk = Boolean(job) && String(job?.schedule) === "40 4 * * *" && job?.active === true;
    cronDetail = job;
  } catch (e) {
    cronDetail = e instanceof Error ? e.message : String(e);
  }
  check(
    "cron purge-anon-devices : posé, actif, 04:40 daily (tempo 30 j, arbitrage point 11)",
    cronOk,
    cronDetail,
  );

  console.log(`\nfcm-parity-web: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-0065 crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
