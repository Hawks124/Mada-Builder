import { readFile } from "node:fs/promises";
import path from "node:path";
import { slugifyHeading } from "@/lib/slug";

export { slugifyHeading };

export type LegalHeading = { id: string; text: string };

/**
 * Le corps d'un doc découpé sur ses marqueurs de bloc.
 *
 * Pas de `remark-directive` ni de MDX : une ligne contenant **uniquement**
 * `{{block:cle}}` devient un point d'insertion où le layout glisse un
 * composant React. L'avantage sur une directive markdown : le placement reste
 * piloté par le rédacteur, en clair, dans le fichier qu'il édite.
 */
export type LegalPart = { kind: "markdown"; text: string } | { kind: "block"; key: string };

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  /** Corps complet, marqueurs compris. Pratique pour les métadonnées. */
  body: string;
  /** Corps découpé, prêt à renderer. */
  parts: LegalPart[];
  /** Clés de blocs attendues, dans l'ordre du document. */
  blocks: string[];
  headings: LegalHeading[];
};

/** `{{block:cle}}` seul sur sa ligne. */
const BLOCK_RE = /^\{\{block:([a-z0-9-]+)\}\}\s*$/gm;

/** Parse minimal du frontmatter (title/description/updated + body). */
function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep > 0) {
      meta[line.slice(0, sep).trim()] = line
        .slice(sep + 1)
        .trim()
        .replace(/^"|"$/g, "");
    }
  }
  return { meta, body: match[2] };
}

/** Découpe le corps sur les marqueurs de bloc, en gardant l'ordre. */
function splitParts(body: string): { parts: LegalPart[]; blocks: string[] } {
  const parts: LegalPart[] = [];
  const blocks: string[] = [];
  let last = 0;
  BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCK_RE.exec(body)) !== null) {
    const before = body.slice(last, m.index);
    if (before.trim() !== "") parts.push({ kind: "markdown", text: before });
    parts.push({ kind: "block", key: m[1] });
    blocks.push(m[1]);
    last = m.index + m[0].length;
  }
  const tail = body.slice(last);
  if (tail.trim() !== "") parts.push({ kind: "markdown", text: tail });
  return { parts, blocks };
}

/** Lis un doc légal versionné git. Server-only (fs). */
export async function getLegalDoc(slug: string): Promise<LegalDoc | null> {
  try {
    const filePath = path.join(process.cwd(), "content", "legal", `${slug}.md`);
    const raw = await readFile(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    // Commentaires HTML du fichier (TODO juriste) hors rendu.
    const clean = body.replace(/<!--[\s\S]*?-->/g, "").trim();
    const { parts, blocks } = splitParts(clean);
    const headings: LegalHeading[] = [];
    for (const m of clean.matchAll(/^##\s+(.+)$/gm)) {
      const text = m[1].trim();
      headings.push({ id: slugifyHeading(text), text });
    }
    return {
      slug,
      title: meta.title ?? slug,
      description: meta.description ?? "",
      updated: meta.updated ?? "",
      body: clean,
      parts,
      blocks,
      headings,
    };
  } catch {
    return null;
  }
}
