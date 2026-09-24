import { readFile } from "node:fs/promises";
import path from "node:path";

export type LegalHeading = { id: string; text: string };

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  body: string;
  headings: LegalHeading[];
};

/** Slug FR simple — même règle que les ancres GitHub, sans dépendance. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

/** Lis un doc légal versionné git. Server-only (fs). */
export async function getLegalDoc(slug: string): Promise<LegalDoc | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "content",
      "legal",
      `${slug}.md`,
    );
    const raw = await readFile(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    // Commentaires HTML du fichier (TODO juriste) hors rendu.
    const clean = body.replace(/<!--[\s\S]*?-->/g, "").trim();
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
      headings,
    };
  } catch {
    return null;
  }
}
