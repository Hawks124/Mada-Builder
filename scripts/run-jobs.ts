// Jobs manuels/dev (`scripts/run-jobs.ts [all|scores|featured|purge|sweep|revenue]`) :
// mêmes fonctions que pg_cron en prod (setup.sql §7), mêmes formules.
// Usage: npx tsx scripts/run-jobs.ts scores
// `digest` et `audience` = manuels seuls (jamais dans `all`) : l'un envoie
// des emails, l'autre touche l'audience Resend.
import "./_env";
import { purgeStaleDrafts, sweepR2Orphans } from "@/services/products.service";
import { recountDownloadCounts } from "@/services/builds.service";
import { recomputeScores, rotateFeaturedDaily } from "@/services/ranking.service";
import { purgeNotifications, sendWeeklyDigest } from "@/services/notifications.service";
import { syncRevenueHourly } from "@/services/revenue/sync";

async function main(): Promise<void> {
  const which = process.argv[2] ?? "all";
  if (which === "all" || which === "scores") {
    const r = await recomputeScores();
    console.log(`jobs: scores recalculés (${r.updated} fiches, ${r.promoted} poids promus)`);
    // Compteurs dénormalisés reconstruits depuis les événements : le même
    // passage répare le score ET les téléchargements (jamais de dérive).
    const d = await recountDownloadCounts();
    console.log(`jobs: téléchargements recomptés (${d.updated} fiches)`);
  }
  if (which === "all" || which === "featured") {
    const r = await rotateFeaturedDaily();
    console.log(`jobs: produit du jour = ${r.productId ?? "aucun"} (${r.tier})`);
  }
  if (which === "all" || which === "purge") {
    const r = await purgeStaleDrafts();
    console.log(`jobs: brouillons purgés (${r.purged})`);
  }
  if (which === "all" || which === "sweep") {
    const { r2Configured } = await import("@/lib/r2");
    if (!r2Configured()) {
      console.log("jobs: sweep R2 skiǸ (stockage non configurǸ)");
    } else {
      const r = await sweepR2Orphans();
      console.log(`jobs: R2 scannǸs ${r.scanned}, orphelins purgǸs ${r.deleted}`);
      const { abortStaleMultipartUploads } = await import("@/lib/r2");
      const m = await abortStaleMultipartUploads().catch(() => ({ aborted: 0 }));
      console.log(`jobs: multipart abandonnés (> 24 h) : ${m.aborted}`);
    }
  }
  if (which === "all" || which === "notifs") {
    const r = await purgeNotifications();
    console.log(`jobs: notifications purgées (${r.purged})`);
  }
  if (which === "all" || which === "revenue") {
    const r = await syncRevenueHourly();
    console.log(
      `jobs: revenus sync=${r.synced} échecs=${r.failed} nouvellement en échec=${r.newlyFailing}`,
    );
  }
  if (which === "digest") {
    const dry = process.argv.includes("--dry-run");
    // `--force` efface le verrou de la semaine (rattrapage après un
    // envoi avorté — lot B). Jamais en cron de nuit : le verrou hebdo
    // est là pour ça.
    const force = process.argv.includes("--force");
    const r = await sendWeeklyDigest({ dryRun: dry, force });
    console.log(`jobs: digest ${dry ? "(dry-run) " : ""}éligibles=${r.eligible} envoyés=${r.sent}`);
  }
  if (which === "audience") {
    const dry = process.argv.includes("--dry-run");
    const { syncNewsletterAudience } = await import("@/services/newsletter.service");
    const r = await syncNewsletterAudience({ dryRun: dry });
    console.log(
      `jobs: audience ${dry ? "(dry-run) " : ""}éligibles=${r.eligible} créés=${r.created} retirés=${r.removed} opt-out=${r.optedOut}`,
    );
  }
  if (which === "announce") {
    // Préavis légal : --doc confidentialite|conditions --summary "…" --effective "entre en vigueur le …"
    const arg = (name: string): string | null => {
      const i = process.argv.indexOf(`--${name}`);
      return i >= 0 ? (process.argv[i + 1] ?? null) : null;
    };
    const doc = arg("doc");
    const summary = arg("summary");
    const effective = arg("effective") ?? "entre en vigueur dans 15 jours";
    if ((doc !== "confidentialite" && doc !== "conditions") || !summary) {
      console.error(
        'jobs: announce exige --doc confidentialite|conditions --summary "ce qui change" [--effective "…"]',
      );
      process.exit(1);
    }
    const dry = process.argv.includes("--dry-run");
    const { announceLegalUpdate } = await import("@/services/notifications.service");
    const r = await announceLegalUpdate({ doc, summary, effectiveLabel: effective, dryRun: dry });
    console.log(
      `jobs: préavis ${doc} ${dry ? "(dry-run) " : ""}membres=${r.members} notifiés=${r.notified} emailés=${r.emailed}`,
    );
  }
}

main().catch((e) => {
  console.error("run-jobs crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
