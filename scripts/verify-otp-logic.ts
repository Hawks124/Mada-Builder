// Logique OTP PURE, sans réseau ni DB : format du code, hash, comparaison
// timing-safe, expiry, burn tentatives, normalisation email, messages
// génériques. Usage: npx tsx scripts/verify-otp-logic.ts
import "./_env";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_REQUEST_WINDOW,
  OtpError,
  attemptsExhausted,
  codesMatch,
  generateCode,
  hashCode,
  isExpired,
  normalizeEmail,
} from "../services/otp.service";
import { buildLimitKey } from "../lib/ratelimit";

let pass = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (cond) pass++;
  else process.exitCode = 1;
};

// 1. Format : 200 codes, toujours 6 chiffres (padStart inclus).
let formatOk = true;
for (let i = 0; i < 200; i++) {
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(generateCode())) {
    formatOk = false;
    break;
  }
}
ok(`200 codes au format ${OTP_LENGTH} chiffres`, formatOk);

// 2. Hash : déterministe, 64 hex, irréversible (jamais le clair dedans).
const h1 = hashCode("123456");
ok("SHA-256 déterministe", h1 === hashCode("123456"));
ok("SHA-256 64 hex", /^[0-9a-f]{64}$/.test(h1));
ok("hash ≠ clair", !h1.includes("123456"));
ok("emails différents → hashs différents", hashCode("a") !== hashCode("b"));

// 3. Comparaison : match exact, rejet reste (timing-safe, pas d'oracle).
ok("match exact", codesMatch(hashCode("654321"), hashCode("654321")));
ok("rejet code faux", !codesMatch(hashCode("654320"), hashCode("654321")));
ok("rejet hash corrompu", !codesMatch(hashCode("654321"), `${h1.slice(0, 63)}0`));

// 4. Expiry : passé/futur/frontière.
ok("expiré (passé)", isExpired(new Date(Date.now() - 1000)));
ok("valide (futur)", !isExpired(new Date(Date.now() + 60_000)));
ok("frontière now = expiré", isExpired(new Date(Date.now())));

// 5. Burn : 4 tentatives OK, 5e = épuisé.
ok("4 tentatives restantes", !attemptsExhausted(OTP_MAX_ATTEMPTS - 1));
ok("5 tentatives = burn", attemptsExhausted(OTP_MAX_ATTEMPTS));
ok("au-delà = burn", attemptsExhausted(OTP_MAX_ATTEMPTS + 3));

// 6. Normalisation email (clé DB stable).
ok("trim + lowercase", normalizeEmail("  Test@Exemple.COM ") === "test@exemple.com");

// 7. Messages publics : TOUJOURS génériques (anti-oracle), reason interne.
const publicMessages = new Set(
  (["invalid", "expired", "exhausted", "throttled", "unavailable"] as const).map(
    (reason) => new OtpError(reason).message,
  ),
);
ok(
  "5 reasons → 1 seul message public",
  publicMessages.size === 1 && publicMessages.has("Code incorrect ou expiré."),
);

// 8. Rate-limit partagé : clé stable + fenêtre OTP en un seul endroit.
// (Le comportement Redis se QA en manuel : double demande < 60 s → OK
// silencieux sans 2e email. Ici : purs.)
ok("fenêtre OTP 60 s / 1", OTP_REQUEST_WINDOW.window === "60 s" && OTP_REQUEST_WINDOW.max === 1);
ok(
  "clé stable (case/whitespace)",
  buildLimitKey("otp:request", "  Test@Exemple.COM ") === "otp:request:test@exemple.com",
);
ok("namespaces isolés", buildLimitKey("otp:request", "a@b.c") !== buildLimitKey("votes", "a@b.c"));

console.log(`\n${pass} checks OK`);
