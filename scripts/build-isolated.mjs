/**
 * Build de production dans un dossier DISTINCT de celui du serveur dev.
 *
 * Pourquoi : `next dev` et `next build` partagent `.next` par défaut.
 * Lancer un build pendant que le dev tourne écrase les chunks du dev →
 * le serveur dev meurt en « destination stream closed early » → la page
 * affiche « network error » et le spinner tourne indéfiniment.
 *
 * Usage : `npm run build:isolated` (dossier `.next-build`).
 * Le serveur dev peut tourner pendant ce build, sans risque.
 */
import { spawnSync } from "node:child_process";

const dist = process.env.NEXT_DIST_DIR ?? ".next-build";
const isWindows = process.platform === "win32";
const cmd = isWindows ? "npx.cmd" : "npx";

const res = spawnSync(cmd, ["next", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: dist },
  shell: isWindows,
});

if (res.error) {
  console.error(`build isolé impossible (${res.error.message})`);
  process.exit(1);
}
process.exit(res.status ?? 1);
