/**
 * Vérif 0058 — filet de reprise RGPD (`gdpr_purge_retries`).
 *
 * La purge des preuves d'appel (`appeals/{uid}/…`) pouvait laisser un
 * objet derrière elle à la suppression du compte si le Storage variait
 * à l'instant T : l'utilisateur n'existe plus, personne ne re-personne
 * jamais de la purge. La table persiste l'épisode raté avec l'ownerId,
 * le cron maintenance hebdo la re-essaie.
 *
 * Ce que ça prouve :
 * 1. l'index UNIQUE(owner_id) existe — une ligne par épisode, jamais le
 *    bourrage par requêtes de suppression multiples ;
 * 2. la table est deny-all (RLS + REVOKE) : `authenticated` ne lit RIEN
 *    — un backlog RGPD n'est pas consultable côté client ;
 * 3. le service de reprise (`retryFailedPurges`) s'exécute réellement
 *    sur une ligne du backlog :
 *      - Storage sain  → la purge retire la ligne (cycle sain, bucket
 *        vide inclus) ;
 *      - Storage en panne → le service RELANCE la ligne (attempts
 *        croît + last_error non null) : le filet ne tourne pas en vain,
 *        l'objet laissé derrière n'est plus perdu — plan de récupération
 *        persisté.
 *    Les deux branches prouvent le filet branché : l'assertion bifurque
 *    sur l'état observé du Storage de l'environnement.
 *
 * Mécanique :
 * - phase A (checks SQL) comme verify-0057 : TOUT dans une transaction
 *   annulée en fin par un throw volontaire (aucun COMMIT — le COMMIT
 *   avec savepoints + SET ROLE dans la session du pooler répondait
 *   « permission denied », sans rapport avec les droits réels) ;
 * - phase B (sonde + reprise) : la sonde est comitée via drizzle (la
 *   reprise vit sur la pool de l'app), l'assertion bifurque sur ce qui
 *   est observé, la sonde est nettoyée en finally.
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0058-gdpr-purge-retries.ts`
 */
import "./_env";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gdprPurgeRetries } from "@/db/schema";
import { retryFailedPurges } from "@/services/users.service";

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

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante.");
  if (process.env.VERIFY_ALLOW_PROD !== "1") {
    console.error(
      "  Base de production possible. Relance avec VERIFY_ALLOW_PROD=1 si c'est intentionnel.",
    );
    process.exit(1);
  }

  const ownerId = uuidv7(); // sonde : sans FK, elle n'attend aucun user
  try {
    const sql = postgres(url, { prepare: false, max: 1 });

    // ── Phase A : checks SQL (index unique, deny-all, 23505) ─────────
    // Transaction annulée à la fin (throw volontaire, pattern 0057) :
    // aucun COMMIT, aucun résidu à nettoyer.
    await sql.begin(async (tx) => {
      const [uIdx] = await tx`
        SELECT i.indisunique, i.indisvalid
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'gdpr_purge_retries_owner_id_key'`;
      check(
        "index UNIQUE(owner_id) présent et valide",
        Boolean(uIdx?.indisunique && uIdx?.indisvalid),
        uIdx,
      );

      // Deny-all : `authenticated` ne peut pas lire (REVOKE). La
      // requête refusée vit dans un SAVEPOINT pour isoler l'erreur.
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true)", [
        `{"sub": "${ownerId}", "role": "authenticated"}`,
      ]);
      let readRefused = false;
      let code: string | undefined;
      await tx.unsafe("SAVEPOINT sp_read");
      try {
        await tx`SELECT * FROM public.gdpr_purge_retries LIMIT 1`;
      } catch (e) {
        code = (e as PgErr).code;
        readRefused = true;
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_read");
      check("lecture `authenticated` refusée (deny-all, RLS)", readRefused, { code });

      // UNIQUE(owner_id) : le second insert sur le même owner → 23505.
      // RESET ROLE : retour au rôle de connexion (owner-side).
      await tx.unsafe("RESET ROLE");
      await tx`
        INSERT INTO public.gdpr_purge_retries (owner_id, attempts, last_error)
        VALUES (${ownerId}, 0, null)`;
      let ownerDup = false;
      await tx.unsafe("SAVEPOINT sp_dup");
      try {
        await tx`
          INSERT INTO public.gdpr_purge_retries (owner_id, attempts, last_error)
          VALUES (${ownerId}, 0, null)`;
      } catch (e) {
        ownerDup = (e as PgErr).code === "23505";
      }
      await tx.unsafe("ROLLBACK TO SAVEPOINT sp_dup");
      check("second épisode sur le même owner refusé (23505)", ownerDup);

      throw new Error("rollback volontaire — aucun résidu");
    });
    await sql.end();
  } catch (e) {
    // Rollback volontaire = succès ; tout autre throw remonte.
    if (!(e instanceof Error) || !e.message.includes("rollback volontaire")) throw e;
  }

  // ── Phase B : sonde + reprise (drizzle / service) ─────────────────
  try {
    // La sonde est comitée via le pool de l'app — la reprise la voit.
    await db
      .insert(gdprPurgeRetries)
      .values({ ownerId, attempts: 0, lastError: null })
      .onConflictDoNothing({ target: gdprPurgeRetries.ownerId });

    // Reprise : Storage sain → purge saine (0 objets) → ligne retirée ;
    // Storage en panne → catch → re-enqueue (attempts croît).
    let retryOk = false;
    let retryDetail = "";
    try {
      await retryFailedPurges();
      retryOk = true;
    } catch (e) {
      retryDetail = e instanceof Error ? e.message : String(e);
    }
    check("reprise du backlog exécutée sans crash", retryOk, retryDetail);
    const [after] = await db
      .select({
        attempts: gdprPurgeRetries.attempts,
        lastError: gdprPurgeRetries.lastError,
      })
      .from(gdprPurgeRetries)
      .where(eq(gdprPurgeRetries.ownerId, ownerId));
    if (after === undefined) {
      // Storage sain : la purge a pu essayer, bucket vide → la ligne
      // sort du backlog (cycle sain).
      check("reprise réussie : la ligne sort du backlog (Storage sain, purge saine)", true);
    } else {
      // Storage indisponible : le filet a relancé la ligne.
      check(
        "reprise ratée : la ligne reste au backlog, attempts croît et last_error non null",
        after.attempts >= 1 && after.lastError !== null,
        after,
      );
    }
  } finally {
    // Aucun résidu : la sonde est retirée si la reprise ne l'a pas faite.
    await db
      .delete(gdprPurgeRetries)
      .where(eq(gdprPurgeRetries.ownerId, ownerId))
      .catch(() => {});
  }

  console.log(`\ngdpr_purge_retries : ${pass} ok, ${fail} KO`);
  // Sortie explicite : le pool drizzle de l'app garde une socket vivante
  // après le log (aucun sql.end() n'existe pour lui) — sans exit, le
  // process traîne après le résultat.
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify-0058-gdpr crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
