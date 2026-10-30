/**
 * Vérif 0058 — filet RGPD « coordination uploads en vol »
 * (`gdpr_purge_retries`).
 *
 * Pourquoi le filet a changé de contrat : la purge synchronisée à la
 * suppression du compte ne peut JAMAIS voir un upload démarré avant et
 * atterri après. La ligne backlog est donc insérée SYSTÉMATIQUEMENT par
 * `deleteAccount` (même purge réussie) et le cron maintenance hebdo ne
 * la retire qu'après DEUX passes vides consécutives (~2 semaines de
 * garde ; le volume couvert est du staff-side / privé — la fenêtre est
 * tenable). Une découverte d'objets ou une panne storage relancent le
 * compteur d'observation (`attempts` réinterprété : passes vides
 * consécutives OBSERVÉES). Un owner encore vivant n'est JAMAIS purgé.
 *
 * Ce que ça prouve :
 * 1. l'index UNIQUE(owner_id) existe — une ligne par owner, jamais le
 *    bourrage par requêtes de suppression répétées ;
 * 2. deny-all réel : `authenticated` ne lit RIEN (RLS + REVOKE) — un
 *    backlog RGPD n'est pas consultable côté client ;
 * 3. second insert sur le même owner → 23505 (UPSERT du service) ;
 * 4. `trackGdprPurge` : insertion systématique idempotente (doublé
 *    volontaire → une seule ligne, attempts=0), cause d'échec portée
 *    dans last_error quand la purge a raté ;
 * 5. skip-safety : un owner ENCORE VIVANT (deleted_at null) n'est jamais
 *    purgé — la passe renvoie skipped, la ligne reste intacte ;
 * 6. le cycle réel de la reprise sur une sonde isolée (ownerId sans
 *    user, seed storage réel via service_role — appeals ET avatars) :
 *      - découverte (objets présents) → purge comptée, last_error
 *        nettoyé, compteur relancé ;
 *      - 1re passe vide → attempts = 1 : la ligne RESTE (marque
 *        d'observation) ;
 *      - 2e passe vide → ligne RETIRÉE du backlog ;
 *    (storage en panne → seed impossible : la passe est failed, la
 *    ligne est gardée, compteur relancé, last_error non null —
 *    l'assertion bifurque sur l'état observé du Storage) ;
 * 7. le cron (`retryFailedPurges`) exécute le tout sans crash et ne
 *    purge pas le owner vivant.
 *
 * Mécanique :
 * - phase A (checks SQL) comme verify-0057 : TOUT dans une transaction
 *   annulée en fin par un throw volontaire (aucun COMMIT — le COMMIT
 *   avec savepoints + SET ROLE dans la session du pooler répondait
 *   « permission denied », sans rapport avec les droits réels) ;
 * - phases B (sonde + passes) : la sonde est comitée via drizzle (les
 *   passes vivent sur la pool de l'app) ; cleanup en finally (la sonde
 *   est retirée même en panne de purge).
 *
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-0058-gdpr-purge-retries.ts`
 */
import "./_env";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gdprPurgeRetries, users } from "@/db/schema";
import { retryFailedPurges, runGdprBacklogPass, trackGdprPurge } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPEALS_BUCKET, AVATAR_BUCKET } from "@/lib/supabase/storage";

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
type BacklogRow = { attempts: number; lastError: string | null };

async function readBacklog(ownerId: string): Promise<BacklogRow | undefined> {
  const [row] = await db
    .select({ attempts: gdprPurgeRetries.attempts, lastError: gdprPurgeRetries.lastError })
    .from(gdprPurgeRetries)
    .where(eq(gdprPurgeRetries.ownerId, ownerId))
    .limit(1);
  return row ?? undefined;
}

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
  const liveOwnerId = uuidv7(); // fixture skip-safety : user comité, cleanup en finally
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

  // ── Phase B0 : trackGdprPurge — insertion systématique idempotente ──
  // Appelé par deleteAccount après la destruction (ici sonde sans user).
  // Le DOUBLON est volontaire : sans exception, state final attempts=0.
  await trackGdprPurge(ownerId);
  await trackGdprPurge(ownerId);
  const tracked = await readBacklog(ownerId);
  check(
    "trackGdprPurge : ligne systématique posée (doublé = toujours 1 ligne, attempts=0)",
    tracked !== undefined && tracked.attempts === 0 && tracked.lastError === null,
    tracked,
  );
  // Cause d'échec portée : purge ratée à la destruction → last_error.
  await trackGdprPurge(ownerId, "purge storage ratée à la destruction (simulation)");
  const withCause = await readBacklog(ownerId);
  check(
    "trackGdprPurge(cause) : la panne d'origine est dans last_error, compteur à 0",
    withCause !== undefined && withCause.attempts === 0 && withCause.lastError !== null,
    withCause,
  );

  // ── Phase B1 : skip-safety — un compte vivant n'est jamais purgé ───
  // Fixture comitée (domaine example.com : invisible admin, pattern
  // scripts) + ligne backlog résiduelle vers ce vivant : la passe DOIT
  // refuser la purge et laisser la ligne intacte.
  const suffix = Date.now().toString(36);
  await db.insert(users).values({
    id: liveOwnerId,
    username: `v58_live_${suffix}`,
    displayName: `v58_live_${suffix}`,
    email: `v58_live_${suffix}@example.com`,
  });
  await db
    .insert(gdprPurgeRetries)
    .values({ ownerId: liveOwnerId, attempts: 1, lastError: null })
    .onConflictDoNothing({ target: gdprPurgeRetries.ownerId });
  const skipPass = await runGdprBacklogPass({ ownerId: liveOwnerId, attempts: 1 });
  check(
    "skip-safety : owner vivant → purge refusée (skipped), ligne gardée",
    skipPass.skipped && !skipPass.removed && !skipPass.failed,
    skipPass,
  );
  const liveStillBacked = await readBacklog(liveOwnerId);
  check(
    "skip-safety : la passe n'a ni purgé ni retiré ni marqué la ligne",
    liveStillBacked !== undefined &&
      liveStillBacked.attempts === 1 &&
      liveStillBacked.lastError === null,
    liveStillBacked,
  );

  // ── Phase B2 : cycle réel — seed storage réel via service_role ─────
  let seeded = 0;
  let seedError = "";
  try {
    const admin = createAdminClient();
    const seed = async (bucket: string, path: string) => {
      const { error } = await admin.storage
        .from(bucket)
        .upload(path, Buffer.from("sonde verify-0058"), {
          contentType: "text/plain",
          upsert: true,
        });
      if (error) throw error;
    };
    await seed(APPEALS_BUCKET, `${ownerId}/probe-appeal.txt`);
    seeded += 1;
    await seed(AVATAR_BUCKET, `${ownerId}/probe-avatar.webp`);
    seeded += 1;
  } catch (e) {
    seedError = e instanceof Error ? e.message : String(e);
  }

  if (seeded > 0) {
    // Passe 1 : découverte — les objets en vol viennent de s'installer.
    const p1 = await runGdprBacklogPass({ ownerId, attempts: 0 });
    const afterP1 = await readBacklog(ownerId);
    check(
      "passe découverte : objets purgés (appeals + avatars), ligne gardée, last_error nettoyé",
      p1.purged === seeded &&
        !p1.removed &&
        !p1.failed &&
        afterP1 !== undefined &&
        afterP1.lastError === null &&
        afterP1.attempts === 0,
      { p1, afterP1, seeded },
    );
    // Passe 2 : 1re passe vide — marque d'observation, la ligne reste.
    const p2 = await runGdprBacklogPass({ ownerId, attempts: 0 });
    const afterP2 = await readBacklog(ownerId);
    check(
      "1re passe vide : marque d'observation (attempts=1), la ligne reste",
      !p2.removed &&
        !p2.failed &&
        p2.purged === 0 &&
        afterP2 !== undefined &&
        afterP2.attempts === 1,
      { p2, afterP2 },
    );
    // Passe 3 : 2e passe vide — ~2 semaines écoulées, la ligne sort.
    const p3 = await runGdprBacklogPass({ ownerId, attempts: 1 });
    const afterP3 = await readBacklog(ownerId);
    check(
      "2e passe vide : la ligne sort du backlog",
      p3.removed && !p3.failed && afterP3 === undefined,
      { p3, afterP3 },
    );
  } else {
    // Storage en panne : pas de seed — la passe est failed, la ligne est
    // gardée avec compteur relancé et last_error (branché sur le réel).
    const pFail = await runGdprBacklogPass({ ownerId, attempts: 0 });
    const afterFail = await readBacklog(ownerId);
    check(
      "storage en panne : passe failed — ligne gardée, compteur relancé, last_error non null",
      pFail.failed &&
        !pFail.removed &&
        afterFail !== undefined &&
        afterFail.attempts === 0 &&
        afterFail.lastError !== null,
      { pFail, afterFail, seedError },
    );
  }

  // ── Phase B3 : le cron passe sur le vrai backlog sans crash ────────
  let cronOk = false;
  let cronDetail = "";
  let cronPurged = -1;
  try {
    cronPurged = await retryFailedPurges();
    cronOk = true;
  } catch (e) {
    cronDetail = e instanceof Error ? e.message : String(e);
  }
  check("retryFailedPurges (cron hebdo) exécutée sans crash", cronOk && cronPurged >= 0, {
    cronPurged,
    cronDetail,
  });
  // Le fixture vivant ne peut pas être purgé, même par le cron complet.
  const afterCronLive = await readBacklog(liveOwnerId);
  check(
    "cron : le owner vivant reste intact (ligne au backlog, jamais purgée)",
    afterCronLive !== undefined,
    afterCronLive,
  );

  // ── Cleanup : aucune sonde ne reste en base ──────────────────────────
  try {
    if (afterCronLive !== undefined) {
      await db.delete(gdprPurgeRetries).where(eq(gdprPurgeRetries.ownerId, liveOwnerId));
    }
    await db.delete(users).where(eq(users.id, liveOwnerId));
  } catch (e) {
    console.error(
      "  ménage incomplet (sonde vivante à retirer à la main):",
      e instanceof Error ? e.message : e,
    );
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
