import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { revenueConnections } from "@/db/schema";
import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { checkCron } from "@/lib/api/cron";
import { captureError } from "@/lib/monitoring";
import { sweepR2Orphans } from "@/services/products.service";
import { purgeNotifications } from "@/services/notifications.service";
import { cleanupExpiredOtps } from "@/services/otp.service";
import { recountDownloadCounts } from "@/services/builds.service";
import { retryFailedPurges } from "@/services/users.service";

export const dynamic = "force-dynamic";

/**
 * Cron MAINTENANCE hebdo (`POST /api/cron/maintenance`, Bearer
 * CRON_SECRET — workflow `maintenance-weekly.yml`, samedi 03:43 UTC).
 * Regroupe les jobs applicatifs qui n'ont AUCUN chemin planifié en
 * production (`pg_cron` n'exécute que du SQL) et le filet
 * anti-silence des autres :
 *
 *   1. sweep R2 (orphelins) + abort multipart — nettoyage stockage ;
 *   2. purge des notifications vieillissantes ;
 *   3. purge des OTP expirés (table `auth_otp`) ;
 *   4. recomptage `download_count` (filet TS — la version SQL tourne
 *      déjà en pg_cron quotidien, c'est le même calcul idempotent) ;
 *   5. DEAD MAN SWITCH revenus (PRD §16) — PAR CONNEXION ACTIVE :
 *      une connexion active dont le produit n'a AUCUN snapshot
 *      frais (< 26 h = fenêtre horaire du job + marge) → Sentry.
 *      Le job horaire pourrait mourir en silence (secret expiré,
 *      workflow désactivé…) — une seule fois par semaine le silence
 *      est brisé, et une seule connexion en retard suffit (le MAX
 *      global masquait les mortes derrière celles qui sync bien).
 *
 * Un 200 menteur est interdit ici : toute étape en échec → 503 (le
 * workflow rougit, comme pour digest/revenue).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    checkCron(req);
    const failures: string[] = [];
    const summary: Record<string, unknown> = {};

    // 1. Sweep R2 + multipart — skip proprement si R2 non configuré
    // (contributor sans env : ADR-003, le reste du lot tourne).
    try {
      const { r2Configured, abortStaleMultipartUploads } = await import("@/lib/r2");
      if (r2Configured()) {
        summary.sweep = await sweepR2Orphans();
        // Pas de .catch avalé : un listage multipart en échec remonte au
        // try ci-dessus → `failures` → 503. Un 200 menteur est interdit
        // ici (règle écrite plus bas) — le sweep fait partie du lot.
        summary.multipart = await abortStaleMultipartUploads();
      } else {
        summary.sweep = "skipped:r2-non-configure";
      }
    } catch (e) {
      failures.push("sweep");
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "jobs.maintenance.sweep" });
    }

    // 2. Purge notifications vieillissantes (règles d'expiration du service).
    try {
      summary.notifications = await purgeNotifications();
    } catch (e) {
      failures.push("notifications");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.notifications",
      });
    }

    // 3. OTP expirés purgés (table auth_otp : lignes expirées supprimées).
    try {
      summary.otp = await cleanupExpiredOtps();
    } catch (e) {
      failures.push("otp");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.otp",
      });
    }

    // 4. Recomptage téléchargements (filet TS, idempotent — WHERE diff).
    try {
      summary.downloadCounts = await recountDownloadCounts();
    } catch (e) {
      failures.push("downloadCounts");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.downloadCounts",
      });
    }

    // 5. Dead man switch revenus — PAR CONNEXION ACTIVE : un MAX global
    //    sur tous les snapshots masquerait une connexion morte (> 26 h)
    //    derrière une autre qui sync bien. La fraîcheur se juge par
    //    produit (une connexion = un produit) — une seule connexion en
    //    retard suffit à briser le silence.
    try {
      const conns = await db
        .select({
          productId: revenueConnections.productId,
          provider: revenueConnections.provider,
          last: sql<string | null>`(
            SELECT MAX(s.captured_at) FROM revenue_snapshots s
            WHERE s.product_id = ${revenueConnections.productId}
          )`,
        })
        .from(revenueConnections)
        .where(eq(revenueConnections.status, "active"));
      if (conns.length === 0) {
        summary.revenueStale = "skipped:aucune-connexion-active";
      } else {
        const stale = conns.filter((c) => {
          const lastAt = c.last ? new Date(c.last) : null;
          return !lastAt || Date.now() - lastAt.getTime() > 26 * 3_600_000;
        });
        summary.revenueConns = conns.length;
        summary.revenueStale = stale.length > 0;
        if (stale.length > 0) {
          captureError(
            new Error(
              `Sync revenus morte : ${stale.length}/${conns.length} connexion(s) active(s) sans snapshot < 26 h — ${stale
                .map((c) => `${c.productId} (${c.provider}, dernier : ${c.last ?? "jamais"})`)
                .join(" ; ")}`,
            ),
            { op: "jobs.maintenance.revenueDeadMan" },
          );
        }
      }
    } catch (e) {
      failures.push("revenueDeadman");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.revenueDeadman",
      });
    }

    // 6. Filet RGPD « coordination uploads en vol » : à la suppression du
    //    compte, la ligne backlog `gdpr_purge_retries` est insérée
    //    SYSTÉMATIQUEMENT (un upload en vol peut atterrir APRÈS la purge
    //    ; panne storage = même filet). Reprise hebdo : deux passes VIDES
    //    consécutives avant retrait de la ligne, purge refusée sur un
    //    compte encore vivant (ownerId isolé, sans FK pour cette raison).
    try {
      summary.gdprPurgeRetries = await retryFailedPurges();
    } catch (e) {
      failures.push("gdprPurgeRetries");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.gdprPurgeRetries",
      });
    }

    if (failures.length > 0) {
      throw new ApiError("INTERNAL", 503, `Maintenance en échec : ${failures.join(", ")}.`);
    }
    return apiOk(summary);
  } catch (e) {
    return apiCatch(e, "api.cron.maintenance");
  }
}

export async function GET(): Promise<Response> {
  return apiCatch(
    new ApiError("METHOD_NOT_ALLOWED", 405, "POST uniquement."),
    "api.cron.maintenance",
  );
}
