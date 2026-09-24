// Canal toast partagé (lib/toast.ts) : tones, truncate, round-trip
// encode, URLs relatives/absolues. Usage: npx tsx scripts/verify-toast-params.ts
import { isToastTone, parseToastParam, withToast } from "../lib/toast";

let pass = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (cond) pass++;
  else process.exitCode = 1;
};

// 1. Tones allowlist.
ok("ok/err/info reconnus", isToastTone("ok") && isToastTone("err") && isToastTone("info"));
ok("tone inconnu rejeté", !isToastTone("success") && !isToastTone("") && !isToastTone(null));

// 2. Parse + truncate + fallback.
const direct = parseToastParam("ok:Connexion réussie. Bienvenue !");
ok("parse ok", direct?.tone === "ok" && direct?.message === "Connexion réussie. Bienvenue !");
ok("tone inconnu → info", parseToastParam("weird:Hello")?.tone === "info");
ok("message vide → null", parseToastParam("ok:") === null && parseToastParam(null) === null);
const long = parseToastParam(`err:${"x".repeat(200)}`);
ok("truncate 120", long?.message.length === 120);

// 3. withToast : relatif, query existante, accents encodés.
const u1 = withToast("/", "info", "Vous êtes déconnecté·e.");
ok("relatif", u1.startsWith("/?toast="));
const u2 = withToast("/settings?tab=x", "err", "Liaison impossible.");
ok("query existante (&)", u2.includes("tab=x&toast="));
const roundTrip = parseToastParam(
  decodeURIComponent(new URL(u1, "http://x").searchParams.get("toast") ?? ""),
);
ok(
  "round-trip accents",
  roundTrip?.tone === "info" && roundTrip?.message === "Vous êtes déconnecté·e.",
);

console.log(`\n${pass} checks OK`);
