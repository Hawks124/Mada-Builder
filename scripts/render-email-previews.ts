// Prévisualisation navigateur des emails transactionnels : rend les 5
// templates user-facing (fixtures réalistes) dans html/*.html — la
// vérité des templates, jamais un doublon qui dérive. Ouvrir dans un
// navigateur (clair + sombre), modifier le template, régénérer.
// html/ est gitignoré (artefact local).
// Usage: npx tsx scripts/render-email-previews.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { banNotifyHtml } from "../lib/email-templates/ban-notify";
import { unbanNotifyHtml } from "../lib/email-templates/unban-notify";
import { appealDecisionHtml } from "../lib/email-templates/appeal-decision";
import { roleNotifyHtml } from "../lib/email-templates/role-notify";
import { otpEmailHtml } from "../lib/email-templates/otp-email";

const ORIGIN = "http://localhost:3000";

const pages: Array<[string, string]> = [
  [
    "ban.html",
    banNotifyHtml({
      displayName: "Aina Rakoto",
      banReason: "Votes automatisés détectés sur trois produits.",
      dashboardUrl: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
    }),
  ],
  ["unban.html", unbanNotifyHtml({ displayName: "Aina Rakoto", origin: ORIGIN })],
  [
    "appeal-upheld.html",
    appealDecisionHtml({ displayName: "Aina Rakoto", overturned: false, origin: ORIGIN }),
  ],
  [
    "appeal-overturned.html",
    appealDecisionHtml({ displayName: "Aina Rakoto", overturned: true, origin: ORIGIN }),
  ],
  ["role.html", roleNotifyHtml({ displayName: "Aina Rakoto", promoted: true, origin: ORIGIN })],
  [
    "otp.html",
    otpEmailHtml({
      code: "482913",
      validityMinutes: 10,
      actionLink: `${ORIGIN}/auth/exchange?h=preview`,
      origin: ORIGIN,
    }),
  ],
];

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), "html", "preview");
  await mkdir(dir, { recursive: true });
  for (const [file, html] of pages) {
    if (html.includes("tondomaine") || html.includes("undefined")) {
      throw new Error(`preview ${file} : placeholder ou undefined détecté`);
    }
    await writeFile(path.join(dir, file), html, "utf-8");
  }
  console.log(`previews: ${pages.length} fichiers dans html/preview/`);
}

main().catch((e) => {
  console.error("render-email-previews:", e instanceof Error ? e.message : e);
  process.exit(1);
});
