// Rend les 6 templates email (fixtures) et vérifie : pas de placeholder
// tondomaine, pas d'"undefined" interpolé, marque + footer juridique
// présents sur les 5 templates user-facing.
// Usage: npx tsx scripts/verify-email-templates.ts
import { banNotifyHtml, banNotifyText } from "../lib/email-templates/ban-notify";
import { unbanNotifyHtml, unbanNotifyText } from "../lib/email-templates/unban-notify";
import { appealDecisionHtml, appealDecisionText } from "../lib/email-templates/appeal-decision";
import { roleNotifyHtml, roleNotifyText } from "../lib/email-templates/role-notify";
import { otpEmailHtml, otpEmailText } from "../lib/email-templates/otp-email";
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

const branded = ["ban", "unban", "decision-upheld", "decision-overturned", "role", "otp"];
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
]) {
  const body = rendered.find(([n]) => n === name)?.[1] ?? "";
  check(`${name}: salutation dynamique`, body.includes("Bonjour ") || body.includes("Bonsoir "));
}
{
  const dir = join(process.cwd(), "lib", "email-templates");
  for (const file of ["ban-notify.ts", "unban-notify.ts", "appeal-decision.ts", "role-notify.ts"]) {
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
  check(`${name}: phrase charte`, body.includes("4 règles"));
}

console.log(`email-templates: ${pass} OK, ${fail} KO`);
process.exit(fail === 0 ? 0 : 1);
