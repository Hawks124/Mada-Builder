// Jobs manuels/dev (`scripts/run-jobs.ts [all|scores|featured|purge|sweep]`) :
// mêmes fonctions que pg_cron en prod (setup.sql §7), mêmes formules.
// Usage: npx tsx scripts/run-jobs.ts scores
import "./_env";
import { purgeStaleDrafts, sweepR2Orphans } from "@/services/products.service";
import { recomputeScores, rotateFeaturedDaily } from "@/services/ranking.service";
import { purgeNotifications, sendWeeklyDigest } from "@/services/notifications.service";

async function main(): Promise<void> {
  const which = process.argv[2] ?? "all";
  if (which === "all" || which === "scores") {
    const r = await recomputeScores();
    console.log(`jobs: scores recalculés (${r.updated} fiches, ${r.promoted} poids promus)`);
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
    }
  }
  if (which === "all" || which === "notifs") {
    const r = await purgeNotifications();
    console.log(`jobs: notifications purgées (${r.purged})`);
  }
  if (which === "digest") {
    const dry = process.argv.includes("--dry-run");
    const r = await sendWeeklyDigest({ dryRun: dry });
    console.log(`jobs: digest ${dry ? "(dry-run) " : ""}éligibles=${r.eligible} envoyés=${r.sent}`);
  }
}

main().catch((e) => {
  console.error("run-jobs crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
