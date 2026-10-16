// Rend les 6 templates email (fixtures) et vérifie : pas de placeholder
// tondomaine, pas d'"undefined" interpolé, marque + footer juridique
// présents sur les 5 templates user-facing (+ product-removed, 7e fichier).
// Usage: npx tsx scripts/verify-email-templates.ts
import { banNotifyHtml, banNotifyText } from "../lib/email-templates/ban-notify";
import { unbanNotifyHtml, unbanNotifyText } from "../lib/email-templates/unban-notify";
import { appealDecisionHtml, appealDecisionText } from "../lib/email-templates/appeal-decision";
import { roleNotifyHtml, roleNotifyText } from "../lib/email-templates/role-notify";
import { otpEmailHtml, otpEmailText } from "../lib/email-templates/otp-email";
import { productRemovedHtml, productRemovedText } from "../lib/email-templates/product-removed";
import { productNudgeHtml, productNudgeText } from "../lib/email-templates/product-nudge";
import { digestWeeklyHtml, digestWeeklyText } from "../lib/email-templates/digest-weekly";
import {
  staffBuildSubmittedHtml,
  staffBuildSubmittedText,
  staffFicheSubmittedHtml,
  staffFicheSubmittedText,
} from "../lib/email-templates/staff-review";
import {
  buildApprovedHtml,
  buildApprovedText,
  buildRejectedHtml,
  buildRejectedText,
} from "../lib/email-templates/build-review";
import {
  revenueFailingHtml,
  revenueFailingSubject,
  revenueFailingText,
} from "../lib/email-templates/revenue-failing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOGO_ON_DARK_URL, LOGO_ON_LIGHT_URL } from "../lib/email-templates/brand";

const ORIGIN = "https://exemple.mg";

const rendered: Array<[string, string]> = [
  [
    "ban",
    banNotifyHtml({
      displayName: "Test <User>",
      banReason: "Motif",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "ban-text",
    banNotifyText({
      displayName: "Test",
      banReason: "Motif",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  ["unban", unbanNotifyHtml({ displayName: "Test", origin: ORIGIN, timeZone: null })],
  ["unban-text", unbanNotifyText({ displayName: "Test", origin: ORIGIN, timeZone: null })],
  [
    "decision-upheld",
    appealDecisionHtml({ displayName: "Test", overturned: false, origin: ORIGIN, timeZone: null }),
  ],
  [
    "decision-overturned",
    appealDecisionHtml({ displayName: "Test", overturned: true, origin: ORIGIN, timeZone: null }),
  ],
  [
    "decision-text",
    appealDecisionText({ displayName: "Test", overturned: false, origin: ORIGIN, timeZone: null }),
  ],
  ["role", roleNotifyHtml({ displayName: "Test", promoted: true, origin: ORIGIN, timeZone: null })],
  [
    "role-text",
    roleNotifyText({ displayName: "Test", promoted: false, origin: ORIGIN, timeZone: null }),
  ],
  [
    "otp",
    otpEmailHtml({
      code: "123456",
      validityMinutes: 10,
      actionLink: `${ORIGIN}/auth/exchange?h=x`,
      origin: ORIGIN,
    }),
  ],
  [
    "otp-text",
    otpEmailText({ code: "123456", validityMinutes: 10, actionLink: null, origin: ORIGIN }),
  ],
  [
    "removed",
    productRemovedHtml({
      displayName: "Test <User>",
      productName: "App <Test>",
      reason: "Motif <b>gras</b>",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "removed-text",
    productRemovedText({
      displayName: "Test",
      productName: "App Test",
      reason: "Motif",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "digest",
    digestWeeklyHtml({
      displayName: "Test <User>",
      unread: 3,
      lines: ["X a été approuvé", "Y a dépassé 100 votes"],
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "digest-text",
    digestWeeklyText({
      displayName: "Test",
      unread: 1,
      lines: ["X a été approuvé"],
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "nudge",
    productNudgeHtml({
      displayName: "Test <User>",
      productName: "App <Test>",
      reason: "Motif <b>gras</b>",
      rejectedDays: 5,
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "nudge-text",
    productNudgeText({
      displayName: "Test",
      productName: "App Test",
      reason: "Motif",
      rejectedDays: 1,
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "build-approved",
    buildApprovedHtml({
      displayName: "Test <User>",
      productName: "App <Test>",
      versionLabel: "v1.2.3 (42)",
      productUrl: `${ORIGIN}/products/app-test`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "build-approved-text",
    buildApprovedText({
      displayName: "Test",
      productName: "App Test",
      versionLabel: "v1.2.3 (42)",
      productUrl: `${ORIGIN}/products/app-test`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "build-rejected",
    buildRejectedHtml({
      displayName: "Test <User>",
      productName: "App <Test>",
      versionLabel: "v1.2.3 (42)",
      reason: "Motif <b>gras</b>",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "build-rejected-text",
    buildRejectedText({
      displayName: "Test",
      productName: "App Test",
      versionLabel: "v1.2.3 (42)",
      reason: "Motif",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "revenue-failing",
    revenueFailingHtml({
      displayName: "Test <User>",
      productName: "App <Test>",
      providerLabel: "Stripe",
      reason: "Motif <b>gras</b>",
      dashboardUrl: `${ORIGIN}/dashboard/api`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "revenue-failing-text",
    revenueFailingText({
      displayName: "Test",
      productName: "App Test",
      providerLabel: "Stripe",
      reason: "Motif",
      dashboardUrl: `${ORIGIN}/dashboard/api`,
      origin: ORIGIN,
      timeZone: null,
    }),
  ],
  [
    "staff-fiche",
    staffFicheSubmittedHtml({
      productName: "App <Test>",
      makerDisplayName: "Maker <B>",
      reviewUrl: `${ORIGIN}/admin/review/123`,
      origin: ORIGIN,
      buildNote: "Un APK est encore en revue sur cette fiche.",
    }),
  ],
  [
    "staff-fiche-text",
    staffFicheSubmittedText({
      productName: "App Test",
      makerDisplayName: "Maker B",
      reviewUrl: `${ORIGIN}/admin/review/123`,
      origin: ORIGIN,
      buildNote: null,
    }),
  ],
  [
    "staff-build",
    staffBuildSubmittedHtml({
      productName: "App <Test>",
      makerDisplayName: "Maker <B>",
      versionLabel: "v1.2.3 (42)",
      package: "com.example.app",
      reviewUrl: `${ORIGIN}/admin/review/123`,
      origin: ORIGIN,
      ficheNote: "Fiche en revue elle aussi — tout est à revoir d'un coup.",
    }),
  ],
  [
    "staff-build-text",
    staffBuildSubmittedText({
      productName: "App Test",
      makerDisplayName: "Maker B",
      versionLabel: "v1.2.3 (42)",
      package: null,
      reviewUrl: `${ORIGIN}/admin/review/123`,
      origin: ORIGIN,
      ficheNote: null,
    }),
  ],
];

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

for (const [name, body] of rendered) {
  check(`${name}: pas de tondomaine`, !body.includes("tondomaine"));
  check(`${name}: pas de undefined`, !body.includes("undefined"));
  check(`${name}: pas de lettre B générique`, !body.includes("logo-fallback"));
}

const branded = [
  "ban",
  "unban",
  "decision-upheld",
  "decision-overturned",
  "role",
  "otp",
  "removed",
  "build-approved",
  "build-rejected",
  "staff-fiche",
  "staff-build",
  "revenue-failing",
];
for (const [name, body] of rendered) {
  if (!branded.includes(name)) continue;
  check(`${name}: logo fond clair`, body.includes(LOGO_ON_LIGHT_URL));
  check(`${name}: logo fond sombre`, body.includes(LOGO_ON_DARK_URL));
  check(`${name}: /regles`, body.includes(`${ORIGIN}/regles`));
  check(`${name}: /conditions`, body.includes(`${ORIGIN}/conditions`));
  check(`${name}: /confidentialite`, body.includes(`${ORIGIN}/confidentialite`));
}

// Échappement : le nom avec chevrons ne doit pas casser le HTML.
const banHtml = rendered[0][1];
check("ban: displayName échappé", banHtml.includes("Test &lt;User&gt;"));
const removedHtml = rendered.find(([n]) => n === "removed")?.[1] ?? "";
check("removed: displayName échappé", removedHtml.includes("Test &lt;User&gt;"));
check("removed: produit échappé", removedHtml.includes("App &lt;Test&gt;"));
check("removed: motif échappé", removedHtml.includes("Motif &lt;b&gt;gras&lt;/b&gt;"));
const nudgeHtml = rendered.find(([n]) => n === "nudge")?.[1] ?? "";
check("nudge: displayName échappé", nudgeHtml.includes("Test &lt;User&gt;"));
check("nudge: produit échappé", nudgeHtml.includes("App &lt;Test&gt;"));
check("nudge: motif échappé", nudgeHtml.includes("Motif &lt;b&gt;gras&lt;/b&gt;"));
check("nudge: délai rejeté affiché", nudgeHtml.includes("5 jours"));
const nudgeText = rendered.find(([n]) => n === "nudge-text")?.[1] ?? "";
check("nudge-text: singulier jour", nudgeText.includes("1 jour") && !nudgeText.includes("1 jours"));

const buildApprovedHtmlBody = rendered.find(([n]) => n === "build-approved")?.[1] ?? "";
check("build-approved: displayName échappé", buildApprovedHtmlBody.includes("Test &lt;User&gt;"));
check("build-approved: produit échappé", buildApprovedHtmlBody.includes("App &lt;Test&gt;"));
check("build-approved: version affichée", buildApprovedHtmlBody.includes("v1.2.3 (42)"));
check("build-approved: URL fiche", buildApprovedHtmlBody.includes(`${ORIGIN}/products/app-test`));
const buildApprovedTextBody = rendered.find(([n]) => n === "build-approved-text")?.[1] ?? "";
check("build-approved-text: version", buildApprovedTextBody.includes("v1.2.3 (42)"));
const buildRejectedHtmlBody = rendered.find(([n]) => n === "build-rejected")?.[1] ?? "";
check(
  "build-rejected: motif échappé",
  buildRejectedHtmlBody.includes("Motif &lt;b&gt;gras&lt;/b&gt;"),
);
check(
  "build-rejected: fiche reste en ligne",
  buildRejectedHtmlBody.includes("La fiche reste en ligne"),
);
check("build-rejected: dashboard", buildRejectedHtmlBody.includes(`${ORIGIN}/dashboard`));
const buildRejectedTextBody = rendered.find(([n]) => n === "build-rejected-text")?.[1] ?? "";
check("build-rejected-text: motif", buildRejectedTextBody.includes("Motif : Motif"));

const staffFicheHtml = rendered.find(([n]) => n === "staff-fiche")?.[1] ?? "";
check("staff-fiche: produit échappé", staffFicheHtml.includes("App &lt;Test&gt;"));
check("staff-fiche: maker échappé", staffFicheHtml.includes("Maker &lt;B&gt;"));
check("staff-fiche: cockpit", staffFicheHtml.includes(`${ORIGIN}/admin/review/123`));
check("staff-fiche: ligne binaire", staffFicheHtml.includes("encore en revue"));
const staffFicheText = rendered.find(([n]) => n === "staff-fiche-text")?.[1] ?? "";
check("staff-fiche-text: cockpit", staffFicheText.includes(`${ORIGIN}/admin/review/123`));
const staffBuildHtml = rendered.find(([n]) => n === "staff-build")?.[1] ?? "";
check("staff-build: version affichée", staffBuildHtml.includes("v1.2.3 (42)"));
check("staff-build: package affiché", staffBuildHtml.includes("com.example.app"));
check("staff-build: ligne fiche", staffBuildHtml.includes("en revue elle aussi"));
check("staff-build: cockpit", staffBuildHtml.includes(`${ORIGIN}/admin/review/123`));
const staffBuildText = rendered.find(([n]) => n === "staff-build-text")?.[1] ?? "";
check("staff-build-text: version", staffBuildText.includes("v1.2.3 (42)"));
const revenueFailingHtmlBody = rendered.find(([n]) => n === "revenue-failing")?.[1] ?? "";
check("revenue-failing: displayName échappé", revenueFailingHtmlBody.includes("Test &lt;User&gt;"));
check("revenue-failing: produit échappé", revenueFailingHtmlBody.includes("App &lt;Test&gt;"));
check(
  "revenue-failing: motif échappé",
  revenueFailingHtmlBody.includes("Motif &lt;b&gt;gras&lt;/b&gt;"),
);
check(
  "revenue-failing: CTA reconnecter",
  revenueFailingHtmlBody.includes(`${ORIGIN}/dashboard/api`),
);
check(
  "revenue-failing: sujet produit",
  revenueFailingSubject("App Test") === "Sync revenus en échec — App Test",
);
const revenueFailingTextBody = rendered.find(([n]) => n === "revenue-failing-text")?.[1] ?? "";
check(
  "revenue-failing-text: motif",
  revenueFailingTextBody.includes("MOTIF :") && revenueFailingTextBody.includes("Motif"),
);

// Salutation dynamique : Bonjour ou Bonsoir selon l'heure réelle du run.
// Le rendu seul ne distingue pas calculé vs codé en dur selon l'heure —
// d'où le contrôle source ci-dessous, déterministe.
for (const name of [
  "ban",
  "ban-text",
  "unban",
  "unban-text",
  "decision-upheld",
  "decision-overturned",
  "decision-text",
  "role",
  "role-text",
  "removed",
  "removed-text",
  "nudge",
  "nudge-text",
  "build-approved",
  "build-approved-text",
  "build-rejected",
  "build-rejected-text",
  "revenue-failing",
  "revenue-failing-text",
]) {
  const body = rendered.find(([n]) => n === name)?.[1] ?? "";
  check(`${name}: salutation dynamique`, body.includes("Bonjour ") || body.includes("Bonsoir "));
}
{
  const dir = join(process.cwd(), "lib", "email-templates");
  for (const file of [
    "ban-notify.ts",
    "unban-notify.ts",
    "appeal-decision.ts",
    "role-notify.ts",
    "product-removed.ts",
    "product-nudge.ts",
    "revenue-failing.ts",
  ]) {
    const src = readFileSync(join(dir, file), "utf-8");
    check(`${file}: aucun Bonjour codé en dur`, !src.includes("Bonjour ${"));
  }
}

// Footer modération : la Charte est décrite + incitative, pas muette.
for (const name of [
  "ban",
  "ban-text",
  "unban",
  "unban-text",
  "decision-upheld",
  "decision-overturned",
  "decision-text",
]) {
  const body = rendered.find(([n]) => n === name)?.[1] ?? "";
  check(`${name}: phrase charte`, body.includes("5 règles"));
}

console.log(`email-templates: ${pass} OK, ${fail} KO`);
process.exit(fail === 0 ? 0 : 1);
