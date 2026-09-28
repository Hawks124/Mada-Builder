// Génère lib/brand-paths.ts : chemins + couleurs de marque pour le footer.
//
// Source unique : `simple-icons@16.32.0` (CC0-1.0), le paquet entier en une
// requête (`index.mjs` porte `path` et `hex` par icône). Aucune dépendance
// npm, aucun asset distant au runtime : les valeurs sont figées dans le .ts.
//
// Deux brands posent exception et sont documentés dans le fichier généré :
// `chrome` et `itchio` ont été retirés de Simple Icons avant la v5.0.0, donc
// absents de `index.mjs`. Leurs chemins sont repris tels quels depuis
// `components/ui/store-logo.tsx` (qui les holdait déjà en dur, donc bien
// Simple Icons) et leur `hex` est la couleur de marque officielle, saisie à la
// main — vérifiable, mais pas issue du paquet.
//
// `hexDark` est calculé ici, pas lu : Apple et Steam sont en #000000, npm en
// #CB3837. Rendre ces trois-là sur le footer sombre les fait disparaître, donc
// on force un plancher de clarté pour la variante sombre.
//
// Usage : node scripts/gen-brand-paths.mjs   (puis relire le diff)
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = "16.32.0";
const SRC = `https://unpkg.com/simple-icons@${V}/index.mjs`;
const OUT = join(ROOT, "lib", "brand-paths.ts");
const STORE_LOGO = join(ROOT, "components", "ui", "store-logo.tsx");

/** Plancher de clarté (HSL, 0-1) de la variante sombre. */
const DARK_L_MIN = 0.62;
/** Plafond : évite qu'une marque très claire become un burn-out. */
const DARK_L_MAX = 0.86;

/**
 * key -> [slug simple-icons, libellé, hex de repli si absent du paquet].
 * Le 3ᵉ champ n'est renseigné que pour les 2 brands retirés de Simple Icons.
 */
const WANTED = {
  // Stores mobiles & desktop
  apple: ["apple", "App Store"],
  googleplay: ["googleplay", "Google Play"],
  microsoft: ["__phosphor:WindowsLogo", "Microsoft Store"],
  flathub: ["flathub", "Flathub"],
  // Extensions
  chrome: ["__legacy:chrome", "Chrome Web Store", "4285F4"],
  firefox: ["firefox", "Firefox Add-ons"],
  edge: ["__phosphor:Browser", "Edge Add-ons"],
  // Registres & modèles
  npm: ["npm", "npm"],
  pubdev: ["dart", "pub.dev"],
  pypi: ["pypi", "PyPI"],
  packagist: ["packagist", "Packagist"],
  gomodules: ["go", "Go Modules"],
  maven: ["apachemaven", "Maven"],
  nuget: ["nuget", "NuGet"],
  rubygems: ["rubygems", "RubyGems"],
  homebrew: ["homebrew", "Homebrew"],
  rust: ["rust", "Cargo / crates.io"],
  // Modèles & versions
  hf: ["huggingface", "Hugging Face"],
  github: ["github", "GitHub Releases"],
  // Jeux
  itchio: ["__legacy:itchio", "itch.io", "FA5C5C"],
  steam: ["steam", "Steam"],
  // Plugins
  vscode: ["__phosphor:Code", "VS Code Marketplace"],
  openvsx: ["__phosphor:PuzzlePiece", "Open VSX"],
  figma: ["figma", "Figma Community"],
  wordpress: ["wordpress", "WordPress"],
  // API & chatbots
  postman: ["postman", "Postman"],
  rapidapi: ["__phosphor:Plugs", "RapidAPI"],
  telegram: ["telegram", "Telegram"],
};

// ── couleurs ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h * 6) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  return [r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
}

/** Variante lisible sur fond sombre : hue et saturation conservées, clarté bornée. */
function darken(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return hslToHex([h, s, Math.min(DARK_L_MAX, Math.max(DARK_L_MIN, l))]);
}

// ── source ───────────────────────────────────────────────────────────────────

/** Extrait `path` + `hex` d'une entrée de `index.mjs`, bornée à son objet. */
function fromPackage(src, slug) {
  const i = src.indexOf(`slug:"${slug}"`);
  if (i < 0) return null;
  const next = src.indexOf('{title:"', i + 1);
  const chunk = src.slice(i, next < 0 ? i + 4000 : next);
  const p = chunk.match(/path:"([^"]+)"/);
  const h = chunk.match(/hex:"([0-9A-Fa-f]{6})"/);
  if (!p || !h) return null;
  return { path: p[1], hex: h[1].toUpperCase() };
}

/** Les 2 chemins legacy, repris de store-logo.tsx plutôt que retypés. */
function legacyPaths() {
  const src = readFileSync(STORE_LOGO, "utf8");
  const block = src.slice(
    src.indexOf("const BRAND_PATHS"),
    src.indexOf("};", src.indexOf("const BRAND_PATHS")),
  );
  const out = {};
  const re = /^\s{2}([a-z]+):\s*\n?\s*"([^"]+)",?\s*$/gm;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2];
  return out;
}

async function main() {
  console.log(`lecture ${SRC} …`);
  const src = await (await fetch(SRC, { headers: { "user-agent": "brand-paths" } })).text();
  console.log(`  ${(src.length / 1024 / 1024).toFixed(1)} Mo\n`);

  const legacy = legacyPaths();
  const brands = {};
  const phosphors = [];
  const failed = [];

  for (const [key, entry] of Object.entries(WANTED)) {
    const [slug, label, hexFallback] = entry;

    if (slug.startsWith("__phosphor:")) {
      phosphors.push({ key, label, icon: slug.slice("__phosphor:".length) });
      continue;
    }

    let found;
    if (slug.startsWith("__legacy:")) {
      const name = slug.slice("__legacy:".length);
      if (!legacy[name]) {
        failed.push(`${key}: path legacy « ${name} » introuvable dans store-logo.tsx`);
        continue;
      }
      found = { path: legacy[name], hex: hexFallback.toUpperCase() };
    } else {
      found = fromPackage(src, slug);
      if (!found) {
        failed.push(`${key}: slug « ${slug} » absent de simple-icons@${V}`);
        continue;
      }
    }

    brands[key] = { label, path: found.path, hex: found.hex, hexDark: darken(found.hex) };
    console.log(`  ok   ${key.padEnd(11)} #${found.hex} -> #${brands[key].hexDark}`);
  }

  if (failed.length) {
    console.log("\nÉCHECS :");
    failed.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }

  const body = Object.entries(brands)
    .map(
      ([k, v]) =>
        `  ${k}: {\n    label: ${JSON.stringify(v.label)},\n    hex: ${JSON.stringify(v.hex)},\n    hexDark: ${JSON.stringify(v.hexDark)},\n    path:\n      ${JSON.stringify(v.path)},\n  },`,
    )
    .join("\n");

  const phBody = phosphors
    .map(
      (p) => `  ${p.key}: { label: ${JSON.stringify(p.label)}, icon: ${JSON.stringify(p.icon)} },`,
    )
    .join("\n");

  writeFileSync(
    OUT,
    `/**
 * Marques du footer — chemins et couleurs de \`simple-icons@${V}\` (CC0-1.0).
 *
 * Généré par \`scripts/gen-brand-paths.mjs\`. **Source unique** partagée par le
 * footer (\`components/ui/brand-mark.tsx\`, serveur) ; \`store-logo.tsx\`
 * (client) garde ses 5 chemins en propre, voir le commentaire de ce fichier.
 *
 * \`viewBox 0 0 24 24\`, fill \`currentColor\` : une seule table sert les deux
 * thèmes. Aucune dépendance npm, aucun fetch au runtime.
 *
 * \`hex\` = couleur de marque publiée par Simple Icons. \`hexDark\` = variante
 * calculée (même teinte, clarté bornée entre ${DARK_L_MIN} et ${DARK_L_MAX}) —
 * nécessaire car Apple et Steam sont en #000000 et npm en #CB3837, donc
 * invisibles sur le footer en thème sombre.
 *
 * **\`chrome\` et \`itchio\` font exception** : retirés de Simple Icons avant la
 * v5.0.0, absents du paquet. Leur \`path\` est repris de \`store-logo.tsx\`
 * (Simple Icons, copié à la main à l'époque) et leur \`hex\` est la couleur de
 * marque officielle saisie à la main, pas une donnée du paquet.
 *
 * \`PHOSPHOR_MARKS\` liste les 5 destinations sans marque dans Simple Icons
 * (Microsoft, Edge, VS Code, RapidAPI, Open VSX) : un icône générique vaut
 * mieux qu'un logo approximatif, donc ces 5 gardent un survir monochrome.
 */

/** Chemin Simple Icons (\`fill: currentColor\`) + couleur de marque. */
export const BRAND_PATHS: Record<string, { label: string; hex: string; hexDark: string; path: string }> = {
${body}
};

/** Cles de \`@phosphor-icons/react\` pour les destinations sans marque. */
export const PHOSPHOR_MARKS: Record<string, { label: string; icon: string }> = {
${phBody}
};

/** Label lisible d'une marque — sert au \`title\`/\`aria-label\` du footer. */
export function brandLabel(key: string): string | undefined {
  return BRAND_PATHS[key]?.label ?? PHOSPHOR_MARKS[key]?.label;
}

/**
 * Couleur de survol d'une marque, \`#rrggbb\`. Les destinations sans marque
 * renvoient \`undefined\` : l'appelant garde alors le survir monochrome plutôt
 * que d'inventer une couleur.
 */
export function brandHoverColor(key: string): string | undefined {
  return BRAND_PATHS[key] ? \`#\${BRAND_PATHS[key].hex}\` : undefined;
}

/** Idem, variante lisible sur fond sombre. */
export function brandHoverColorDark(key: string): string | undefined {
  return BRAND_PATHS[key] ? \`#\${BRAND_PATHS[key].hexDark}\` : undefined;
}
`,
    "utf8",
  );

  const total = Object.values(brands).reduce((a, b) => a + b.path.length, 0);
  console.log(`\nécrit ${OUT}`);
  console.log(
    `  ${Object.keys(brands).length} marques (chemin + 2 couleurs), ${phosphors.length} Phosphor`,
  );
  console.log(`  poids des paths : ${(total / 1024).toFixed(1)} Ko`);
}

main();
