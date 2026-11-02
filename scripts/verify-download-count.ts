/**
 * Vérif T1 — la garde de ré-acquisition du compteur download.
 *
 * `resolveDownloadCountMode` (lib/api/download-count.ts) est pure :
 * aucun client HTTP ni base nécessaire. Le contrat (docs/mobile-contrats.md
 * §3) : défaut = chaque résolution compte (+1) ; `?count=0` = marqueur de
 * reprise du natif, accepté UNIQUEMENT avec `Range: bytes=N-` et N > 0 —
 * tout le reste est refusé en 422 franche (`VALIDATION`, message FR
 * exact), jamais décompté en silence.
 *
 * Relance : `npx tsx scripts/verify-download-count.ts` (aucun env requis).
 */
import { resolveDownloadCountMode } from "../lib/api/download-count";
import { ApiError } from "../lib/api/response";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    pass += 1;
    console.log(`  ok: ${name}`);
  } else {
    fail += 1;
    console.error(`  KO: ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** Cas d'erreur : ApiError code VALIDATION + message FR exact. */
function refused(fn: () => unknown): { ok: boolean; detail: unknown } {
  try {
    fn();
    return { ok: false, detail: "aucune erreur levée" };
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        ok: e.code === "VALIDATION" && e.status === 422,
        detail: { code: e.code, status: e.status, message: e.message },
      };
    }
    return { ok: false, detail: String(e) };
  }
}

function main(): void {
  // Le défaut : tout ce qui n'est PAS `count=0` compte.
  check(
    "défaut : sans paramètre, sans header → count (+1)",
    resolveDownloadCountMode(null, null) === "record",
  );
  check(
    "défaut : count=1 (ou autre que 0) → count, jamais un marqueur",
    resolveDownloadCountMode("1", "bytes=50-") === "record",
  );
  check(
    "défaut : Range présent sans count=0 → count (le Range de CETTE route est un marqueur, rien d'autre)",
    resolveDownloadCountMode(null, "bytes=50-") === "record",
  );

  // La ré-acquisition honnête : count=0 + reprise réelle (N > 0).
  check(
    "ré-acquisition : count=0 + bytes=42- → skip (+0)",
    resolveDownloadCountMode("0", "bytes=42-") === "skip",
  );
  check(
    "ré-acquisition : gros offset (N au-delà du int32 JS) → skip",
    resolveDownloadCountMode("0", `bytes=${String(2 ** 40)}-`) === "skip",
  );

  // Refus francs (anti-abuse fail-closed) : count=0 sans reprise valide.
  const validError = (r: { ok: boolean; detail: unknown }): boolean => r.ok;
  const r1 = refused(() => resolveDownloadCountMode("0", null));
  check(
    "count=0 sans header Range → 422 VALIDATION, message FR exact",
    r1.ok &&
      (r1.detail as { message?: string }).message ===
        "count=0 exige un Range de reprise valide (bytes=N- avec N > 0).",
    r1.detail,
  );
  check(
    "count=0 + bytes=0- (rien d'acquis) → 422",
    validError(refused(() => resolveDownloadCountMode("0", "bytes=0-"))),
  );
  check(
    "count=0 + segment borné bytes=10-20 → 422 (pas une reprise ouverte)",
    validError(refused(() => resolveDownloadCountMode("0", "bytes=10-20"))),
  );
  check(
    "count=0 + multi-ranges → 422",
    validError(refused(() => resolveDownloadCountMode("0", "bytes=5-,10-"))),
  );
  check(
    "count=0 + unité étrangère → 422",
    validError(refused(() => resolveDownloadCountMode("0", "items=5-"))),
  );
  check(
    "count=0 + nombre non entier → 422",
    validError(refused(() => resolveDownloadCountMode("0", "bytes=5.5-"))),
  );
  check(
    "count=0 + Range pythonique vide → 422",
    validError(refused(() => resolveDownloadCountMode("0", "bytes=-"))),
  );

  console.log(`\n${pass} ok, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main();
