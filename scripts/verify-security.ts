import "./_env";
import { db } from "@/db";

/**
 * Non-régression SÉCURITÉ (V1).
 *
 * Ce que ce script vérifie — la posture réelle de la plateforme face à
 * une clé anonyme (qui est PUBLIQUE : elle ships dans l'app mobile et
 * dans le navigateur) :
 *
 * 1. RLS activée sur TOUTES les tables publiques (défaut : deny-all
 *    pour anon/authenticated, sauf policies publiques explicites) ;
 * 2. le trigger `users_lock_sensitive` existe et est ACTIVÉ (role,
 *    banned_at, email, username, providers : service_role seul) ;
 * 3. la clé anonyme ne lit RIEN sur les tables sensibles (users,
 *    revenue_connections, admin_actions, email_logs, auth_otp) ;
 * 4. le rôle `authenticated` ne peut écrire que les colonnes de profil
 *    (migration 0046) — pas `role`, pas `banned_at`, pas `email` ;
 * 5. aucune fonction SECURITY DEFINER grantée à `anon` hors celles
 *    attendues (les helpers de trigger + les fonctions de l'extension
 *    trigram, inoffensives).
 *
 * Pourquoi un script : ces protections sont invisibles dans le code
 * applicatif (RLS, privilèges, triggers). Une nouvelle table sans RLS,
 * ou un `GRANT UPDATE` trop large, ne se voit pas — ici, ça casse.
 *
 * Usage : `npx tsx scripts/verify-security.ts`
 */

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

type Row = Record<string, unknown>;

async function query(sql: string): Promise<Row[]> {
  const res = await db.execute(sql);
  return (Array.isArray(res) ? res : ((res as { rows?: Row[] }).rows ?? [])) as Row[];
}

/** Colonnes qu'un maker a le droit d'écrire sur SA ligne `users`. */
const PROFILE_COLUMNS = [
  "avatar_url",
  "bio",
  "city",
  "country",
  "digest_opt_out",
  "display_name",
  "occupation",
  "social_links",
  "time_zone",
  "website_url",
];

/** Colonnes que seul le service doit pouvoir écrire. */
const PROTECTED_COLUMNS = ["role", "banned_at", "email", "username", "providers"];

/** Tables que la clé anonyme ne doit JAMAIS pouvoir lire. */
const ANON_DENIED = [
  "users",
  "revenue_connections",
  "admin_actions",
  "email_logs",
  "auth_otp",
  "product_downloads",
];

/** SECURITY DEFINER acceptables pour `anon` (triggers de la plateforme
 *  + helpers de l'extension trigram, qui ne lisent que leurs index). */
const ALLOWED_SECDEF = new Set(["handle_new_user", "lock_users_sensitive_columns"]);

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. RLS activée partout.
  const tables = await query(
    "select c.relname, c.relrowsecurity from pg_class c " +
      "join pg_namespace n on n.oid = c.relnamespace " +
      "where n.nspname = 'public' and c.relkind in ('r','p')",
  );
  const sansRls = tables.filter((t) => t.relrowsecurity === false).map((t) => t.relname);
  check(`RLS activée sur les ${tables.length} tables`, tables.length > 0 && sansRls.length === 0);
  if (sansRls.length > 0) console.error(`   tables sans RLS : ${sansRls.join(", ")}`);

  // 2. Trigger de verrouillage des colonnes sensibles.
  const triggers = await query(
    "select tgname, tgenabled from pg_trigger t " +
      "where not t.tgisinternal and tgrelid = 'public.users'::regclass",
  );
  const lock = triggers.find((t) => t.tgname === "users_lock_sensitive");
  check("trigger users_lock_sensitive présent", lock !== undefined);
  check("trigger users_lock_sensitive activé", lock?.tgenabled === "O");

  // 3. La clé anonyme ne lit rien sur les tables sensibles.
  if (url && anon) {
    for (const table of ANON_DENIED) {
      const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      let count = -1;
      try {
        const body = (await res.json()) as unknown;
        count = Array.isArray(body) ? body.length : -1;
      } catch {
        count = -1;
      }
      check(`anon ne lit rien sur ${table}`, count === 0);
    }
  } else {
    check("clé anonyme disponible pour le test", false);
  }

  // 4. Privilèges d'écriture du rôle `authenticated` sur `users`.
  const cols = await query(
    "select column_name from information_schema.column_privileges " +
      "where grantee = 'authenticated' and table_schema = 'public' " +
      "and table_name = 'users' and privilege_type = 'UPDATE'",
  );
  const writable = cols.map((c) => String(c.column_name)).sort();
  check(
    "authenticated : UPDATE limité aux colonnes de profil",
    writable.length === PROFILE_COLUMNS.length &&
      PROFILE_COLUMNS.every((c) => writable.includes(c)),
  );
  for (const protectedCol of PROTECTED_COLUMNS) {
    check(`authenticated ne peut pas écrire ${protectedCol}`, !writable.includes(protectedCol));
  }

  // 5. Fonctions SECURITY DEFINER grantées à anon.
  const fns = await query(
    "select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      "where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')",
  );
  const secdef = fns
    .filter((f) => f.prosecdef === true)
    .map((f) => String(f.proname))
    .filter((n) => !ALLOWED_SECDEF.has(n));
  check("aucune fonction SECURITY DEFINER inattendue grantée à anon", secdef.length === 0);
  if (secdef.length > 0) console.error(`   fonctions : ${secdef.join(", ")}`);

  console.log(`security: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`verify-security crash: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
