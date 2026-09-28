// Détection du mojibake : UTF-8 relu en Windows-1252 puis réécrit en UTF-8.
//
// Pourquoi ce script existe : PowerShell 5.1 **relit** un fichier UTF-8 avec la
// page de codes ANSI quand l'encodage n'est pas explicite. Le caractère « é »
// (deux octets C3 A9) devient alors A-circ + copyright, et une réécriture en
// UTF-8 fige la corruption. Le code continue de compiler et les pages rendent :
// le défaut n'est visible qu'à l'écran, donc il passe inaperçu. C'est arrivé
// sur les documents juridiques.
//
// Signature **complète**, et pas seulement A-circ : un tiret cadratin (U+2014)
// relu en CP1252 donne « a-circumflexe » + « euro » (U+20AC), où le premier est
// un caractère français légitime (« âge »). Un détecteur qui ne regarde que
// A-circ et A-circonflexe laisse passer tous les apostrophes typographiques et
// tous les tirets.
//
// Règle retenue : A-circ (U+00C3) et A-circonflexe (U+00C2) **n'apparaissent
// jamais** dans un texte français ou anglais valide — leur présence suffit.
// Pour U+00E2, qui est légitime, on exige le partenaire CP1252 qui trahit la
// corruption. Les caractères sont construits par code point : le script ne peut
// donc pas se signaler lui-même.
//
// Usage : node scripts/check-encoding.mjs        (sort 1 si mojibake)
//        node scripts/check-encoding.mjs --fix  (répare : re-décode CP1252)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = new Set([".ts", ".tsx", ".md", ".mjs", ".js", ".json", ".css", ".mdx"]);
const SKIP = new Set(["node_modules", ".next", ".git", "out", "dist", "coverage"]);

const A_CIRC = String.fromCharCode(0xc3); // A-circ
const A_CIRCONF = String.fromCharCode(0xc2); // A-circonflexe
const A_CIRCFLEX = String.fromCharCode(0xe2); // a-circumflexe
const EURO = String.fromCharCode(0x20ac);
const PARTNERS = new Set([
  EURO,
  String.fromCharCode(0x2122), // tm
  String.fromCharCode(0x0153), // oe
  String.fromCharCode(0x017e), // z-caron
  String.fromCharCode(0x0160), // s-caron
  String.fromCharCode(0x2030), // per mille
]);

/** Caractère détenant le mojibake, et test sur son successeur éventuel. */
const RULES = [
  { ch: A_CIRC, partner: null },
  { ch: A_CIRCONF, partner: null },
  { ch: A_CIRCFLEX, partner: PARTNERS },
];

function findMojibake(text) {
  const hits = [];
  for (const { ch, partner } of RULES) {
    let index = text.indexOf(ch);
    while (index !== -1) {
      const next = text[index + 1];
      const bad = partner === null ? true : next !== undefined && partner.has(next);
      if (bad) {
        hits.push({
          line: text.slice(0, index).split("\n").length,
          sample: JSON.stringify(text.slice(index, index + 3)),
        });
      }
      index = text.indexOf(ch, index + 1);
    }
  }
  return hits;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXT.has(extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * Répare un fichier entièrement corrompu : on le relit comme du latin-1 — les
 * octets UTF-8 d'origine réapparaissent alors — et on le réécrit en UTF-8.
 *
 * Volontairement **global** et non par occurrence : un correctif partiel
 * laisserait mixture de chaînesLATIN1 et UTF-8 dans le même fichier, ce qui est
 * plus difficile à diagnostiquer qu'un fichier entièrement à un seul encodage.
 * Le garde-fou refuse d'écrire un fichier si ça ne réduit pas le nombre
 * d'occurrences, donc un fichier sain n'est jamais abîmé.
 */
function fix(text) {
  const redecoded = Buffer.from(text, "latin1").toString("utf8");
  return findMojibake(redecoded).length < findMojibake(text).length ? redecoded : text;
}

const fixMode = process.argv.includes("--fix");
// `slice(2)` : argv[0] est l'exécutable Node et argv[1] ce fichier. Sans ça, le
// filtre `only` attrapait le chemin de node et ignorait le dépôt entier.
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const self = fileURLToPath(import.meta.url);

let broken = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (file === self) continue;
  if (only && !rel.includes(only)) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const hits = findMojibake(text);
  if (hits.length === 0) continue;

  if (fixMode) {
    const repaired = fix(text);
    if (repaired !== text) {
      writeFileSync(file, repaired, "utf8");
      console.log(`  réparé  ${rel}  (${hits.length} → ${findMojibake(repaired).length})`);
      broken++;
      continue;
    }
  }

  broken++;
  const samples = hits
    .slice(0, 3)
    .map((h) => `L${h.line} ${h.sample}`)
    .join(", ");
  console.log(`  MOJIBAKE  ${rel}  (${hits.length})  ${samples}`);
}

if (broken === 0) {
  console.log("  Aucun mojibake détecté.");
  process.exit(0);
}
console.error(
  `\n  ${broken} fichier(s) corrompu(s).` +
    (fixMode
      ? " Certains n'ont pas pu être réparés automatiquement : réécrivez-les avec l'outil d'édition."
      : " Relancez avec --fix, ou réécrivez le fichier avec l'outil d'édition (jamais via PowerShell)."),
);
process.exit(1);
