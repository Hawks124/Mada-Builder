import { ApiError } from "./response";

/**
 * T1 — résolution du comptage de `GET /api/v1/products/{id}/download`.
 *
 * Deux modes, contractés (docs/mobile-contrats.md §3) :
 * - défaut : chaque résolution compte (+1, via after(recordDownload)) ;
 * - ré-acquisition sans recomptage (`?count=0`) : validée ci-dessous
 *   comme MARQUEUR de reprise du natif — le header `Range` de CETTE
 *   route n'est jamais une plage de lecture (la réponse est un JSON ;
 *   la reprise réelle se passe contre R2, via l'URL presignée
 *   renvoyée). `count=0` n'est accepté qu'avec `Range: bytes=N-` et
 *   N > 0 (des octets survécus) — sinon 422 franche : le contournement
 *   « count=0 partout » est impossible, le compteur reste honnête.
 *
 * Fail-closed par construction : tout ce qui ne matche pas exactement
 * la forme contractée est compté ou refusé, jamais silencieusement
 * décompté.
 */
const RE_ACQUIRE_RANGE = /^bytes=(\d+)-$/;

export function resolveDownloadCountMode(
  countParam: string | null,
  rangeHeader: string | null,
): "record" | "skip" {
  if (countParam !== "0") return "record";
  const match = RE_ACQUIRE_RANGE.exec(rangeHeader ?? "");
  const start = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(start) || start <= 0) {
    throw new ApiError(
      "VALIDATION",
      422,
      "count=0 exige un Range de reprise valide (bytes=N- avec N > 0).",
    );
  }
  return "skip";
}
