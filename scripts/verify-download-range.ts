/**
 * Vérif T2 — contrat Range/ETag du GET signé R2 (reprise du natif).
 *
 * Le bucket `product-builds` est PRIVÉ : toute lecture passe par une URL
 * GET signée (`presignBuildDownload`, validité 5 min). Le worker mobile
 * reprend ses octets contre ces URLs ; le contrat serveur à prouver :
 * - `Range: bytes=N-` (N < taille) → `206` + `Content-Range` exact
 *   (`bytes N-(taille-1)/taille`) ;
 * - l'ETag de l'objet est STABLE entre deux GET signés consécutifs (une
 *   nouvelle signature à chaque résolution, le même objet) — c'est lui
 *   que le natif compare avant de reprendre ;
 * - sans Range → `200` + Content-Length exact ;
 * - `Range` non satisfiable (N ≥ taille) → `416` franche (RFC 9110) —
 *   c'est la condition d'annulation de reprise du natif. L'en-tête
 *   `Content-Range` qui annoncerait la taille totale n'est PAS garanti
 *   sur R2 (comportement S3 : absent de la réponse).
 *
 * Le probe (1 MiB sous `builds/`, traité comme un build fictif via la
 * pipeline réelle de présignature PUT) est supprimé en sortie. Écriture
 * prod : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-download-range.ts`.
 * Sans env R2 : SKIP gracieux, exit 0.
 */
import "./_env";
import {
  APK_CONTENT_TYPE,
  PRODUCT_BUILDS_BUCKET,
  deleteR2Object,
  presignBuildDownload,
  presignBuildUpload,
  r2Configured,
} from "@/lib/r2";

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

/** UUID mine (zone de probe) : `presignBuildUpload` exige une forme UUID. */
const NIL_ID = "00000000-0000-0000-0000-000000000001";
/** Taille du probe : 1 MiB, bornée (le quota 300 Mo n'est pas le sujet). */
const SIZE = 1024 * 1024;
/** Offset de reprise testé : exactement la moitié. */
const OFFSET = SIZE / 2;

async function main(): Promise<void> {
  if (!r2Configured()) {
    console.log("SKIP: Range/ETag sans R2");
    process.exit(0);
  }
  if (process.env.VERIFY_ALLOW_PROD !== "1") {
    console.error(
      "  Bucket de prod possible. Relance avec VERIFY_ALLOW_PROD=1 si c'est intentionnel.",
    );
    process.exit(1);
  }

  // Contenu déterministe (i % 256) : taille et bornes connues à l'avance.
  const probe = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i += 1) probe[i] = i % 256;

  // Passage par la pipeline réelle de PUT build (quota signé, clé confinée)
  // plutôt qu'un client S3 direct : la vérif exerce aussi le chemin D1.
  const { url: putUrl, key } = await presignBuildUpload({
    makerId: NIL_ID,
    productId: NIL_ID,
    contentLength: SIZE,
  });
  const putRes = await fetch(putUrl, {
    method: "PUT",
    body: probe,
    headers: { "Content-Type": APK_CONTENT_TYPE },
  });
  check("PUT direct R2 (probe 1 MiB)", putRes.ok, putRes.status);

  try {
    // 1. Reprise : 206 + Content-Range exact (moitié de l'objet).
    const url1 = await presignBuildDownload(key);
    const resHalf1 = await fetch(url1, { headers: { Range: `bytes=${OFFSET}-` } });
    check(
      "Range bytes=N- → 206 + Content-Range exact",
      resHalf1.status === 206 &&
        resHalf1.headers.get("content-range") === `bytes ${OFFSET}-${SIZE - 1}/${SIZE}`,
      { status: resHalf1.status, cr: resHalf1.headers.get("content-range") },
    );

    // 2. ETag stable entre deux GET signés consécutifs (le contrat est
    //    sur la STABILITÉ de l'Etag de l'objet, jamais sur la forme de
    //    l'URL : deux présignatures à la même seconde produisent même
    //    URL, c'est un détail d'implémentation SigV4 — pas un contrat).
    const url2 = await presignBuildDownload(key);
    const resHalf2 = await fetch(url2, { headers: { Range: `bytes=${OFFSET}-` } });
    const e1 = resHalf1.headers.get("etag");
    const e2 = resHalf2.headers.get("etag");
    check("ETag stable entre deux GET signés", e1 !== null && e1 === e2, {
      e1,
      e2,
    });

    // 3. Sans Range : 200 complet, Content-Length exact.
    const resFull = await fetch(url2);
    check(
      "sans Range → 200 + Content-Length exact",
      resFull.status === 200 && resFull.headers.get("content-length") === String(SIZE),
      { status: resFull.status, cl: resFull.headers.get("content-length") },
    );

    // 4. Reprise au-delà de la fin de l'objet : 416 franc (RFC 9110) —
    //    PAS d'assertion sur l'en-tête Content-Range : R2 (comme S3)
    //    n'en renvoie pas sur 416, et le natif ne doit jamais s'y fier.
    const resOob = await fetch(url2, { headers: { Range: `bytes=${SIZE}-` } });
    check(
      "Range non satisfiable → 416 (reprise annulée, sans header garanti)",
      resOob.status === 416,
      { status: resOob.status, cr: resOob.headers.get("content-range") },
    );
  } finally {
    // Cleanup best-effort (le sweep orphelin purgerait sinon, jamais un
    // utilisateur : la clé vit sous des UUIDs mine).
    await deleteR2Object(PRODUCT_BUILDS_BUCKET, key).catch(() => {});
  }

  console.log(`\n${pass} ok, ${fail} KO`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Probe abortée :", e);
  process.exit(1);
});
