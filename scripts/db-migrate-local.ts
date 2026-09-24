// Usage ponctuel : drizzle-kit ne charge pas .env.local (scripts/_env le
// fait). Charge l'env puis exécute `drizzle-kit migrate` en héritant
// l'environnement — aucun secret n'apparaît ni en clair ni en log.
import "./_env";
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
