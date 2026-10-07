/**
 * Import README / .md → description (lot import) : pipeline PURE partagée
 * client (pré-remplissage instantané) + serveur (ré-appliquée à la
 * soumission — jamais confiance au client). IDEMPOTENTE : f(f(x)) == f(x)
 * (le serveur peut la repasser sans effet sur un texte déjà sanitizé).
 *
 * Ordre : emojis → HTML→markdown → badges → images → liens relatifs
 * → espaces → cap longueur. Chaque étape est un no-op sur son propre
 * résultat.
 */

export type ImportReport = {
  /** Emojis retirés. */
  emojis: number;
  /** Lignes badges supprimées. */
  badges: number;
  /** Images ignorées (relatives sans base + data:). */
  imagesDropped: number;
  /** Tronqué au cap (true = le maker doit compléter). */
  truncated: boolean;
};

export const IMPORT_MAX_LENGTH = 20000;

/** Badges/shields : lignes d'images vers ces hôtes = bruit, jamais du contenu. */
const BADGE_HOSTS = [
  "shields.io",
  "badgen.net",
  "fury.io",
  "travis-ci.",
  "coveralls.io",
  "codecov.io",
  "sonarcloud.io",
  "github.com/workflows",
  "github/actions",
  "img.shields.io",
];

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp"];

function countEmojis(text: string): number {
  const matches = text.match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

/** 1. Emojis : pictos + VS16 + ZWJ, espaces recollées. */
function stripEmojis(text: string): { text: string; count: number } {
  const count = countEmojis(text);
  if (count === 0) return { text, count: 0 };
  const stripped = text
    .replace(/[\uFE00-\uFE0F\u200D]+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[ \t]{2,}/g, " ");
  return { text: stripped, count };
}

/** 2. Badges : drop les lignes contenant une image-badge. */
function stripBadges(text: string): { text: string; count: number } {
  const lines = text.split("\n");
  const kept: string[] = [];
  let count = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    const isBadgeLine =
      lower.includes("!") &&
      lower.includes("](") &&
      (BADGE_HOSTS.some((h) => lower.includes(h)) ||
        lower.includes("badge") ||
        lower.includes("shield"));
    if (isBadgeLine) {
      count++;
      continue;
    }
    kept.push(line);
  }
  return { text: kept.join("\n"), count };
}

/**
 * 2-bis. HTML → markdown (AVANT badges/images/liens, pour que les URLs
 * extraites suivent les mêmes règles) : inline (`b`→`**`, `i/em`→`*`,
 * `code`→backticks, `a`→`[t](u)`, `sub/sup`→texte), blocs (`div/p/
 * section`→newlines, `table`→lignes `cell · cell`, `details`→texte +
 * summary en gras, `ul/ol/li`→listes `-`), reste droppé (texte gardé).
 */
function htmlToMarkdown(text: string): string {
  let out = text;
  // Commentaires d'abord (peuvent contenir des tags).
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // <img src alt> → ![alt](src) (suit ensuite les règles images :
  // hotlink absolue, absolutisée si base, droppée sinon).
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc="([^"]+)"/i);
    const altMatch = tag.match(/\balt="([^"]*)"/i);
    const src = (srcMatch?.[1] ?? "").trim();
    if (src === "") return "";
    return `![${altMatch?.[1] ?? ""}](${src})`;
  });
  // <a href="u">t</a> → [t](u) (le href vide → texte).
  out = out.replace(
    /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_m, href: string, inner: string) =>
      href.trim() !== "" ? `[${inner.trim()}](${href.trim()})` : inner.trim(),
  );
  // Inline.
  out = out.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**");
  out = out.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*");
  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, "`$1`");
  out = out.replace(/<(sub|sup)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "$2");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  // <details><summary>t</summary>corps</details> → **t** + corps.
  out = out.replace(/<details\b[^>]*>([\s\S]*?)<\/details\s*>/gi, (_m, inner: string) =>
    inner.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/gi, "**$1**\n\n"),
  );
  // Tables HTML → syntaxe markdown (rendues en vrai tableau fiche +
  // preview via remark-gfm). Fallback lignes "cell · cell" si structure
  // complexe (colspan/rowspan, imbrication — jamais de tableau cassé).
  out = out.replace(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi, (_m, inner: string) => {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
    let rowMatch: RegExpExecArray | null;
    let complex = false;
    while ((rowMatch = rowRe.exec(inner)) !== null) {
      if (/colspan|rowspan/i.test(rowMatch[1])) complex = true;
      const cells: string[] = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
        const cell = cellMatch[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (cell !== "") cells.push(cell.replace(/\|/g, "\\|"));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return "";
    if (complex) {
      return `\n\n${rows.map((r) => r.join(" · ")).join("\n\n")}\n\n`;
    }
    const width = Math.max(...rows.map((r) => r.length));
    const norm = rows.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill("")]);
    const [head, ...body] = norm;
    const sep = head.map(() => "---");
    return `\n\n| ${head.join(" | ")} |\n| ${sep.join(" | ")} |\n${body.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n\n`;
  });
  // Listes HTML → listes markdown.
  out = out.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _tag: string, inner: string) => {
    const items: string[] = [];
    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRe.exec(inner)) !== null) {
      const item = liMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (item !== "") items.push(`- ${item}`);
    }
    return items.length > 0 ? `\n\n${items.join("\n")}\n\n` : "";
  });
  // Blocs restants → newlines (le texte intérieur est gardé).
  out = out.replace(
    /<\/?(div|p|section|article|header|footer|main|span|font|center)\b[^>]*>/gi,
    "\n",
  );
  // Tags résiduels → texte (jamais de HTML brut dans la description).
  out = out.replace(/<\/?[a-z][a-z0-9]*(?:\s+[^<>]*)?\/?>/gi, "");
  return out;
}

/** 3. HTML : drop commentaires + picture/img, <br> → newline. */
function stripHtml(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<img\b[^>]*\/?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
}

function isAbsoluteHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isDataUrl(url: string): boolean {
  return /^data:/i.test(url);
}

function imageExt(url: string): string | null {
  const clean = url.split("?")[0]?.split("#")[0] ?? "";
  const m = clean.match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase() ?? null;
  return ext && IMAGE_EXTS.includes(ext) ? ext : null;
}

/**
 * 4. Images markdown `![alt](src)` :
 * - `data:` → strip (bloat base64) ;
 * - absolues http(s) → hotlink tel quel (Prose durci : no-referrer + hide) ;
 * - relatives + base → absolutisées (raw repo) ;
 * - relatives sans base → alt (ou rien).
 */
function rewriteImages(text: string, base?: string): { text: string; dropped: number } {
  let dropped = 0;
  const out = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (match, alt: string, src: string) => {
      const s = String(src).trim();
      if (s === "" || isDataUrl(s)) {
        dropped++;
        return alt !== "" ? alt : "";
      }
      if (isAbsoluteHttp(s)) return match;
      // Relative : fragment seul (#…) → texte (compté comme ignoré).
      if (s.startsWith("#")) {
        dropped++;
        return alt !== "" ? alt : "";
      }
      if (base) {
        try {
          return `![${alt}](${new URL(s, base).toString()})`;
        } catch {
          dropped++;
          return alt !== "" ? alt : "";
        }
      }
      dropped++;
      return alt !== "" ? alt : "";
    },
  );
  return { text: out, dropped };
}

/**
 * 5. Liens relatifs `[texte](docs/x)` → texte (les absolus restent).
 * Les ancres `[x](#y)` → texte.
 */
function flattenRelativeLinks(text: string, base?: string): string {
  return text.replace(
    /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (match, label: string, href: string) => {
      const h = String(href).trim();
      if (isAbsoluteHttp(h) || h.startsWith("#") || h.startsWith("mailto:")) {
        return h.startsWith("#") ? label : match;
      }
      if (base && imageExt(h) === null) {
        try {
          return `[${label}](${new URL(h, base).toString()})`;
        } catch {
          return label;
        }
      }
      return label;
    },
  );
}

/** 6. Espaces : lignes vides 3+ → 2, trim final. */
function collapseWhitespace(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export type SanitizeOptions = {
  /** Base repo pour absolutiser (import URL) — absente = alt + compteur. */
  base?: string;
  /** Cap longueur (défaut schéma). */
  maxLength?: number;
};

export function sanitizeImportedMarkdown(
  raw: string,
  opts?: SanitizeOptions,
): { text: string; report: ImportReport } {
  const maxLength = opts?.maxLength ?? IMPORT_MAX_LENGTH;
  const base = opts?.base;
  const emojis = stripEmojis(raw);
  // HTML → markdown AVANT badges/images/liens (les URLs extraites des
  // <a>/<img> suivent les mêmes règles que le markdown natif).
  const html = htmlToMarkdown(emojis.text);
  const badges = stripBadges(html);
  const noHtml = stripHtml(badges.text);
  const images = rewriteImages(noHtml, base);
  const links = flattenRelativeLinks(images.text, base);
  const collapsed = collapseWhitespace(links);
  const truncated = collapsed.length > maxLength;
  return {
    text: truncated ? collapsed.slice(0, maxLength).trimEnd() : collapsed,
    report: {
      emojis: emojis.count,
      badges: badges.count,
      imagesDropped: images.dropped,
      truncated,
    },
  };
}

/**
 * Résout la base raw d'un repo depuis une URL (`github.com/u/r` ou raw
 * directe). Retourne `{ base, branch }` — l'appelant essaie `main`
 * puis `master`. Hôtes allowlistés (SSRF : jamais de fetch aveugle —
 * le fetch lui-même passe par `checkUrl` côté appelant).
 */
/**
 * Résout les candidats README depuis une URL (`github.com/u/r` ou raw
 * directe). Retourne les URLs à essayer dans l'ordre (`main` puis
 * `master`) + la base pour absolutiser les assets relatifs.
 * Hôtes allowlistés (SSRF : jamais de fetch aveugle — le fetch lui-même
 * passe par `checkUrl` côté appelant).
 */ export function resolveReadmeCandidates(
  input: string,
): { urls: string[]; base: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  // Raw directe : le dossier du fichier sert de base aux assets.
  if (host === "raw.githubusercontent.com" && parts.length >= 3) {
    const file = url.pathname;
    const dir = file.endsWith(".md") ? file.slice(0, file.lastIndexOf("/") + 1) : file;
    return {
      urls: [`https://raw.githubusercontent.com${file}`],
      base: `https://raw.githubusercontent.com${dir}`,
    };
  }
  const branches = ["main", "master"];
  if (host === "github.com" && parts.length >= 2) {
    const owner = parts[0];
    const repo = (parts[1] ?? "").replace(/\.git$/, "");
    if (!owner || !repo) return null;
    return {
      urls: branches.map(
        (b) => `https://raw.githubusercontent.com/${owner}/${repo}/${b}/README.md`,
      ),
      base: `https://raw.githubusercontent.com/${owner}/${repo}/main/`,
    };
  }
  if (host === "gitlab.com" && parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1] ?? "";
    if (!owner || !repo) return null;
    return {
      urls: branches.map((b) => `https://gitlab.com/${owner}/${repo}/-/raw/${b}/README.md`),
      base: `https://gitlab.com/${owner}/${repo}/-/raw/main/`,
    };
  }
  if ((host === "bitbucket.org" || host === "codeberg.org") && parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1] ?? "";
    if (!owner || !repo) return null;
    const raw = host === "bitbucket.org" ? "raw" : "raw/branch";
    return {
      urls: branches.map((b) => `https://${host}/${owner}/${repo}/${raw}/${b}/README.md`),
      base: `https://${host}/${owner}/${repo}/${raw}/main/`,
    };
  }
  return null;
}

/** Hôtes autorisés pour un fetch raw direct (licence, mode `raw`). */
export const RAW_FETCH_HOSTS = [
  "raw.githubusercontent.com",
  "gitlab.com",
  "bitbucket.org",
  "codeberg.org",
];

/** URL raw directe autorisée (fichier texte : LICENSE, COPYING…) ou null.
 * Les URLs de PAGE (`github.com/o/r/blob/<b>/<path>`,
 * `gitlab.com/o/r/-/blob/<b>/<path>`) sont converties en raw : l'utilisateur
 * colle ce qu'il voit dans son navigateur, jamais une URL raw. */
export function resolveRawFile(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "github.com" && parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
    const [owner, repo, , branch, ...rest] = parts;
    if (!owner || !repo || !branch || rest.length === 0) return null;
    url = new URL(
      `https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, "")}/${branch}/${rest.join("/")}`,
    );
  } else if (
    host === "gitlab.com" &&
    parts.length >= 6 &&
    parts[2] === "-" &&
    parts[3] === "blob"
  ) {
    const [owner, repo, , , branch, ...rest] = parts;
    if (!owner || !repo || !branch || rest.length === 0) return null;
    url = new URL(`https://gitlab.com/${owner}/${repo}/-/raw/${branch}/${rest.join("/")}`);
  }
  const resolvedHost = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!RAW_FETCH_HOSTS.includes(resolvedHost)) return null;
  if (
    !/\.(md|markdown|txt)$/i.test(url.pathname) &&
    !/(^|\/)(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(url.pathname)
  ) {
    return null;
  }
  return url.toString();
}
