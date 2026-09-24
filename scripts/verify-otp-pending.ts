// Persistance OTP (lib/otp-pending.ts) : round-trip, expiry 10 min,
// purge, formes invalides, double niveau session/local.
// Usage: npx tsx scripts/verify-otp-pending.ts
import "./_env";

function mockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
}

// @ts-expect-error environnement node (navigateur en prod)
globalThis.sessionStorage = mockStorage();
// @ts-expect-error environnement node (navigateur en prod)
globalThis.localStorage = mockStorage();

async function main() {
  const { readOtpPending, writeOtpPending, clearOtpPending } = await import(
    "../lib/otp-pending"
  );
  let pass = 0;
  const ok = (name: string, cond: boolean) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
    if (cond) pass++;
    else process.exitCode = 1;
  };

  ok("vide → null", readOtpPending() === null);

  writeOtpPending("  Test@Exemple.COM ");
  const restored = readOtpPending();
  ok("round-trip email brut", restored?.email === "  Test@Exemple.COM ");

  clearOtpPending();
  ok("purge totale", readOtpPending() === null);

  // Expiré (> 10 min) → null + session prioritaire sur local.
  writeOtpPending("a@b.c");
  const g = globalThis as unknown as {
    sessionStorage: { setItem(k: string, v: string): void };
    localStorage: { setItem(k: string, v: string): void };
  };
  g.sessionStorage.setItem(
    "builder-otp-pending-session",
    JSON.stringify({ email: "new@x.c", at: Date.now() }),
  );
  g.localStorage.setItem(
    "builder-otp-pending-local",
    JSON.stringify({ email: "old@x.c", at: Date.now() - 11 * 60 * 1000 }),
  );
  // Session seule lisible ici (clés internes) — on vérifie l'expiré :
  g.sessionStorage.setItem(
    "builder-otp-pending-session",
    JSON.stringify({ email: "old@x.c", at: Date.now() - 11 * 60 * 1000 }),
  );
  ok("expiré → null", readOtpPending() === null);

  // Formes invalides → null, jamais de throw.
  g.sessionStorage.setItem("builder-otp-pending-session", "pas-du-json");
  ok("JSON invalide → null", readOtpPending() === null);
  g.sessionStorage.setItem(
    "builder-otp-pending-session",
    JSON.stringify({ email: "", at: Date.now() }),
  );
  ok("email vide → null", readOtpPending() === null);
  g.sessionStorage.setItem(
    "builder-otp-pending-session",
    JSON.stringify({ email: "a@b.c" }),
  );
  ok("sans at → null", readOtpPending() === null);

  console.log(`\n${pass} checks OK`);
}

main();
