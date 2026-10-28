import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { revenueConnections, revenueSnapshots } from "@/db/schema";
import { apiCatch, apiOk, ApiError } from "@/lib/api/response";
import { checkCron } from "@/lib/api/cron";
import { captureError } from "@/lib/monitoring";
import { sweepR2Orphans } from "@/services/products.service";
import { purgeNotifications } from "@/services/notifications.service";
import { cleanupExpiredOtps } from "@/services/otp.service";
import { recountDownloadCounts } from "@/services/builds.service";

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
 *   5. DEAD MAN SWITCH revenus (PRD §16) : si des connexions actives
 *      existent sans AUCUN snapshot frais (< 26 h = fenêtre horaire du
 *      job + marge) → Sentry. Le job horaire pourrait mourir en
 *      silence (secret expiré, workflow désactivé…) — une seule fois
 *      par semaine le silence est brisé.
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
        summary.multipart = await abortStaleMultipartUploads().catch(() => ({ aborted: 0 }));
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

    // 5. Dead man switch revenus.
    try {
      const [conn] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(revenueConnections)
        .where(eq(revenueConnections.status, "active"));
      if ((conn?.n ?? 0) > 0) {
        const [row] = await db
          .select({ last: sql<string | null>`MAX(captured_at)` })
          .from(revenueSnapshots);
        const lastAt = row?.last ? new Date(row.last) : null;
        const stale = !lastAt || Date.now() - lastAt.getTime() > 26 * 3_600_000;
        summary.revenueStale = stale;
        if (stale) {
          captureError(
            new Error(
              `Sync revenus morte : dernier snapshot ${lastAt?.toISOString() ?? "jamais"} (> 26 h), ${conn?.n ?? 0} connexion(s) active(s)`,
            ),
            { op: "jobs.maintenance.revenueDeadMan" },
          );
        }
      } else {
        summary.revenueStale = "skipped:aucune-connexion-active";
      }
    } catch (e) {
      failures.push("revenueDeadman");
      captureError(e instanceof Error ? e : new Error(String(e)), {
        op: "jobs.maintenance.revenueDeadman",
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
