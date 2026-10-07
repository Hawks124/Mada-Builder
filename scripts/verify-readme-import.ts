import { resolveReadmeCandidates, sanitizeImportedMarkdown } from "@/lib/readme-import";
import { detectSpdx } from "@/lib/spdx";

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

async function main(): Promise<void> {
  // 1. Emojis (dont ZWJ + VS16).
  const e1 = sanitizeImportedMarkdown("Super app 🎉 pour gérer 💰 et ✅\uFE0F!");
  check("emojis retirés", !/🎉|💰|✅/.test(e1.text) && e1.report.emojis >= 3);
  check("texte conservé", e1.text.includes("Super app") && e1.text.includes("pour gérer"));

  // 2. Badges.
  const e2 = sanitizeImportedMarkdown(
    "# Titre\n[![build](https://github.com/u/r/workflows/ci/badge.svg)](x)\n![npm](https://img.shields.io/npm/v/x)\nTexte.",
  );
  check(
    "badges droppés",
    e2.report.badges === 2 && e2.text.includes("# Titre") && e2.text.includes("Texte."),
  );

  // 3. Images absolues gardées, data: droppée, relatives selon base.
  const e3 = sanitizeImportedMarkdown(
    "![a](https://example.com/x.png) ![b](./docs/y.jpg) ![c](data:image/png;base64,AAA) ![d](#ancre)",
    { base: "https://raw.githubusercontent.com/u/r/main/" },
  );
  check(
    "images absolue + absolutisée",
    e3.text.includes("https://example.com/x.png") &&
      e3.text.includes("https://raw.githubusercontent.com/u/r/main/docs/y.jpg"),
  );
  check("data: + ancre droppées", e3.report.imagesDropped === 2 && !e3.text.includes("data:"));
  const e3b = sanitizeImportedMarkdown("Voir ![shot](./docs/y.jpg) ici.");
  check("relative sans base → alt", e3b.text.includes("shot") && !e3b.text.includes("./docs"));

  // 4. Liens relatifs → texte, absolus gardés.
  const e4 = sanitizeImportedMarkdown(
    "[docs](./docs/a.md) et [site](https://example.com) et [top](#top)",
  );
  check(
    "liens relatifs aplatis",
    e4.text.includes("docs") &&
      e4.text.includes("[site](https://example.com)") &&
      e4.text.includes("top"),
  );

  // 5. HTML : commentaires + img droppés, br → newline.
  const e5 = sanitizeImportedMarkdown('A<!-- secret -->B<br>C<img src="x.png"/>D');
  check(
    "HTML sanitizé",
    e5.text.includes("A") &&
      e5.text.includes("B") &&
      e5.text.includes("C") &&
      !e5.text.includes("secret") &&
      !e5.text.includes("<img"),
  );

  // 6. Cap + idempotence.
  const long = "a".repeat(25000);
  const e6 = sanitizeImportedMarkdown(long, { maxLength: 100 });
  check("cap + truncated", e6.text.length === 100 && e6.report.truncated === true);
  const sample = "# T 🎉\n![b](https://img.shields.io/x)\n![i](./d/y.png)\n\n\n\nFin.";
  const once = sanitizeImportedMarkdown(sample, {
    base: "https://raw.githubusercontent.com/u/r/main/",
  });
  const twice = sanitizeImportedMarkdown(once.text, {
    base: "https://raw.githubusercontent.com/u/r/main/",
  });
  check(
    "idempotent",
    twice.text === once.text && twice.report.emojis === 0 && twice.report.badges === 0,
  );

  // 7. Résolution URL.
  const gh = resolveReadmeCandidates("https://github.com/u/r");
  check(
    "github main→master",
    gh !== null &&
      gh.urls[0] === "https://raw.githubusercontent.com/u/r/main/README.md" &&
      gh.urls[1] ===
        "https://raw.githubusercontent.com/u/r/main/README.md".replace("/main/", "/master/"),
  );
  check("hôte inconnu → null", resolveReadmeCandidates("https://evil.com/u/r") === null);
  check("texte libre → null", resolveReadmeCandidates("pas une url") === null);
  const raw = resolveReadmeCandidates("https://raw.githubusercontent.com/u/r/main/docs/README.md");
  check(
    "raw directe",
    raw !== null &&
      raw.urls[0] === "https://raw.githubusercontent.com/u/r/main/docs/README.md" &&
      raw.base === "https://raw.githubusercontent.com/u/r/main/docs/",
  );

  // 8. HTML → markdown (cas openGym).
  const h1 = sanitizeImportedMarkdown(
    '<div align="center">\n**Un tracker.**\n</div>\n<sub><b>Home</b> · workout</sub>',
  );
  check(
    "html inline converti",
    h1.text.includes("**Un tracker.**") &&
      h1.text.includes("**Home**") &&
      !h1.text.includes("<div") &&
      !h1.text.includes("<sub"),
  );
  const h2 = sanitizeImportedMarkdown(
    '<table><tr><td align="center"><b>A</b> · x</td><td><b>B</b> · y</td></tr></table>',
  );
  check(
    "table HTML → markdown",
    h2.text.includes("| **A** · x | **B** · y |") &&
      h2.text.includes("| --- | --- |") &&
      !h2.text.includes("<table"),
  );
  const h2b = sanitizeImportedMarkdown(
    '<table><tr><td colspan="2">Fusion</td></tr><tr><td>A</td><td>B</td></tr></table>',
  );
  check(
    "table complexe → lignes",
    h2b.text.includes("Fusion") && h2b.text.includes("A · B") && !h2b.text.includes("| --- |"),
  );
  const h3 = sanitizeImportedMarkdown(
    "<details><summary><b>Config</b> (via .env)</summary>\n| A | B |\n</details>",
  );
  check(
    "details → gras + texte",
    h3.text.includes("**Config**") &&
      h3.text.includes("| A | B |") &&
      !h3.text.includes("<details"),
  );
  const h4 = sanitizeImportedMarkdown(
    '<a href="https://buymeacoffee.com/x" target="_blank">café</a>',
  );
  check("lien HTML → markdown", h4.text.includes("[café](https://buymeacoffee.com/x)"));
  const h5 = sanitizeImportedMarkdown('<img src="https://example.com/s.png" alt="shot">', {
    base: "https://raw.githubusercontent.com/u/r/main/",
  });
  check("img HTML → hotlink", h5.text.includes("![shot](https://example.com/s.png)"));

  // 9. Détection SPDX (identifiant seul, jamais le texte).
  check("MIT", detectSpdx("Permission is hereby granted, free of charge, to any person") === "MIT");
  check(
    "Apache-2.0",
    detectSpdx("Licensed under the Apache License, Version 2.0, January 2004") === "Apache-2.0",
  );
  check("GPL-3.0", detectSpdx("GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007") === "GPL-3.0");
  check(
    "ISC",
    detectSpdx("Permission to use, copy, modify, and/or distribute this software") === "ISC",
  );
  check(
    "AGPL avant GPL",
    detectSpdx("GNU Affero General Public License, version 3") === "AGPL-3.0",
  );
  check("inconnue → null", detectSpdx("Lorem ipsum dolor sit amet, consectetur.") === null);

  console.log(`readme-import: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-readme-import crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
