// Salutation dynamique : bornes, fuseaux réels, replis.
// Fuseaux de test NEUTRES uniquement : UTC + décalage numérique
// Etc/GMT-5 (= UTC+5, sans DST, sans localité). Aucune ville en dur,
// nulle part — le repli prod est UTC, assumé neutre.
// Usage: npx tsx scripts/verify-greeting.ts
import { FALLBACK_TIME_ZONE, emailGreeting, getDaypartGreeting } from "../lib/greeting";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

async function main(): Promise<void> {
  const at = (utcIso: string) => new Date(utcIso);

  // Bornes (UTC) : 05:00 inclus, 18:00 exclu.
  check("04:59 → Bonsoir", getDaypartGreeting(at("2026-09-24T04:59:00Z"), "UTC") === "Bonsoir");
  check("05:00 → Bonjour", getDaypartGreeting(at("2026-09-24T05:00:00Z"), "UTC") === "Bonjour");
  check("17:59 → Bonjour", getDaypartGreeting(at("2026-09-24T17:59:00Z"), "UTC") === "Bonjour");
  check("18:00 → Bonsoir", getDaypartGreeting(at("2026-09-24T18:00:00Z"), "UTC") === "Bonsoir");

  // Le fuseau est honoré : même instant, deux zones → deux salutations.
  // 13:00Z = 13:00 UTC (Bonjour) mais 18:00 à UTC+5 (Bonsoir).
  check("UTC 13:00 → Bonjour", getDaypartGreeting(at("2026-09-24T13:00:00Z"), "UTC") === "Bonjour");
  check(
    "UTC+5 18:00 → Bonsoir",
    getDaypartGreeting(at("2026-09-24T13:00:00Z"), "Etc/GMT-5") === "Bonsoir",
  );
  check(
    "UTC+5 17:59 → Bonjour",
    getDaypartGreeting(at("2026-09-24T12:59:00Z"), "Etc/GMT-5") === "Bonjour",
  );

  // Fuseau invalide : repli sans crash (vocabulaire fermé garanti).
  const bad = getDaypartGreeting(at("2026-09-24T12:00:00Z"), "Mars/Olympus");
  check("fuseau invalide → repli", bad === "Bonjour" || bad === "Bonsoir");

  // Raccourci serveur : null = repli neutre, jamais d'exception.
  const fallback = emailGreeting(null);
  check("emailGreeting(null) → fermé", fallback === "Bonjour" || fallback === "Bonsoir");
  check("repli neutre, pas une localité", FALLBACK_TIME_ZONE === "UTC");

  console.log(`greeting: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-greeting crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
