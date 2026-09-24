import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Charge .env.local dans process.env (sans écraser l'existant).
 * tsx ne lit pas les .env tout seul — ce helper évite la dépendance dotenv
 * pour 3 scripts. Usage : `import "./_env";` en première ligne.
 */
export function loadLocalEnv(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  const raw = readFileSync(file, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    // Retire guillemets + commentaire trailing ("val"   # note).
    const m = value.match(/^"((?:[^"\\]|\\.)*)"\s*(#.*)?$/);
    if (m) {
      value = m[1].replace(/\\"/g, '"');
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Auto-chargement à l'import (usage : `import "./_env";` en première ligne).
loadLocalEnv();
