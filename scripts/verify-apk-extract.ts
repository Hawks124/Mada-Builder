/**
 * Extraction APK (D2) : manifest (app-info-parser) + certificats maison
 * (v1/v2/v3) + SHA. Fixtures : APK synthétiques (v2/v3, layout réel
 * pad16, mixte résiduel+tolerance — offline, toujours) + vrai APK
 * F-Droid (téléchargé une fois, cache temp, SKIP sans réseau).
 * Le SHA du cert F-Droid est croisé openssl (CIARANG.RSA) — référence.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ApkParseError,
  bufferReader,
  extractApkCerts,
  extractApkManifest,
  normalizeManifestRaw,
} from "@/lib/apk";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

/** Le mapping refuse-t-il franc (MANIFEST_FAILED) au lieu de données fausses ? */
function failsManifest(input: unknown): boolean {
  try {
    normalizeManifestRaw(input);
    return false;
  } catch (e) {
    return e instanceof ApkParseError && e.code === "MANIFEST_FAILED";
  }
}

// Certificat PUBLIC F-Droid (CIARANG, clé publique uniquement — aucun
// secret) : fixture de référence, SHA croisé via openssl x509.
const FIXTURE_CERT_HEX =
  "3082035e30820246a00302010202044c49cd00300d06092a864886f70d01010505003071310b300906035504061302554b3110300e06035504081307556e6b6e6f776e3111300f0603550407130857657468657262793110300e060355040a1307556e6b6e6f776e3110300e060355040b1307556e6b6e6f776e311930170603550403131043696172616e2047756c746e69656b73301e170d3130303732333137313032345a170d3337313230383137313032345a3071310b300906035504061302554b3110300e06035504081307556e6b6e6f776e3111300f0603550407130857657468657262793110300e060355040a1307556e6b6e6f776e3110300e060355040b1307556e6b6e6f776e311930170603550403131043696172616e2047756c746e69656b7330820122300d06092a864886f70d01010105000382010f003082010a028201010096d075e47c014e7822c89fd67f795d23203e2a8843f53ba4e6b1bf5f2fd0e225938267cfcae7fbf4fe596346afbaf4070fdb91f66fbcdf2348a3d92430502824f80517b156fab00809bdc8e631bfa9afd42d9045ab5fd6d28d9e140afc1300917b19b7c6c4df4a494cf1f7cb4a63c80d734265d735af9e4f09455f427aa65a53563f87b336ca2c19d244fcbba617ba0b19e56ed34afe0b253ab91e2fdb1271f1b9e3c3232027ed8862a112f0706e234cf236914b939bcf959821ecb2a6c18057e070de3428046d94b175e1d89bd795e535499a091f5bc65a79d539a8d43891ec504058acb28c08393b5718b57600a211e803f4a634e5c57f25b9b8c4422c6fd90203010001300d06092a864886f70d0101050500038201010008e4ef699e9807677ff56753da73efb2390d5ae2c17e4db691d5df7a7b60fc071ae509c5414be7d5da74df2811e83d3668c4a0b1abc84b9fa7d96b4cdf30bba68517ad2a93e233b042972ac0553a4801c9ebe07bf57ebe9a3b3d6d663965260e50f3b8f46db0531761e60340a2bddc3426098397fda54044a17e5244549f9869b460ca5e6e216b6f6a2db0580b480ca2afe6ec6b46eedacfa4aa45038809ece0c5978653d6c85f678e7f5a2156d1bedd8117751e64a4b0dcd140f3040b021821a8d93aed8d01ba36db6c82372211fed714d9a32607038cdfd565bd529ffc637212aaa2c224ef22b603eccefb5bf1e085c191d4b24fe742b17ab3f55d4e6f05ef";
const FIXTURE_SHA = "43238d512c1e5eb2d6569f4a3afbf5523418b82e0a3ed1552770abb9a9c9ccab";

/**
 * Paires de signature RÉELLES (octets exacts, base64) :
 * - V2 : ketch-android-0.10.0.apk — CN=linroid, RSA/2048.
 * - V3 : OnyxCalc.apk — CN=Onyx Calc (O=RiRi), RSA/2048.
 *
 * Elles encodent le format APK réel — y compris le uint32 qui préfixe
 * la VALEUR d'une paire. C'est ce préfixe que le parseur ignorait :
 * tout le contenu était décalé de 4 octets et TOUS les APK réels
 * signés étaient refusés (« aucun certificat X.509 lisible »). Ces
 * octets byte-exact sont la régression qui empêche le retour de ce
 * bug : le format testé est le format réel, pas une approximation.
 */
const REAL_V2_PAIR_B64 = [
  "WAUAAAAAAAAahwlxUAUAAEwFAAAOAwAALAAAACgAAAADAQAAIAAAAE87XxKBqE9So3IUfA9N4EKGhf9AtcekoF6PHCOgfcCp0gIA",
  "AM4CAAAwggLKMIIBsqADAgECAgkAz7aDvYUKw2cwDQYJKoZIhvcNAQEMBQAwEjEQMA4GA1UEAxMHbGlucm9pZDAgFw0yNjAyMTMw",
  "NzIxMzJaGA8yMDUxMDIwNzA3MjEzMlowEjEQMA4GA1UEAxMHbGlucm9pZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB",
  "AKgYSXEDo8VlqMBtmSYCuRbcBwLmxqyeQaswVKmDdFX0JUyM7QmoNeeg9rUdF9lJchlxcYQaQOmMMjG2f6VKJ1yX5gLEHnA9GLhj",
  "PU7fdXyDvynhgKSw2rId1aJQZMQPYV/j6U8a/SGbq4w7b1XITzpXTDxYI8wW7jGiAvEbIqTfBbbcldxkLUGgLESg6pyglqg51leE",
  "uacJ4BPRw7MLRb/W1P5Kmc10UVioO18HPXHiUtF8F0kE9ZCLXTVnkp2CSEdV4c+aBIFsIH2MP7L+TVhvHKAwINoZaD43lB8KKkAW",
  "/QHN2O8c3EW+H6VTp8ZdXm4HkXDN204UQHNe+pXtHFECAwEAAaMhMB8wHQYDVR0OBBYEFMebuWRCagL0d3dnVpaF6KPgNaidMA0G",
  "CSqGSIb3DQEBDAUAA4IBAQBKPsgkzK8lUBKQfoJJGwrqzcXpWlo6XsvfcFlxEAsqd3FJgAE9J2j9fRaesGr74cxD1ICSJQcy/dba",
  "TCWpVV4VeQ2XEm2cCTfIOt10bTNz1DuxXahPj+ER56cGg0taAFXKyZ3z/ZRNeyFjVyZRqd8V9xomiDlAj4tgGkQ/ofLYVqhbYlXx",
  "0u5HrfVLy+WvG1wFMRjgE16+/uGq4fnTtNEE7UcS/3/XCZeuFHHN++c4EsXSEZ8iy1c/qDYEoL1yPPCNrtLut9QqzyG8xaWGpTQ5",
  "C//ICDOhJcCjPl5kGT60i/u+1Hcp4fWklqXKQ/L2I6857OaMbYcMf5G92O8BZVScAAAAAAAAAAAMAQAACAEAAAMBAAAAAQAAE0FI",
  "LaAuQ3Ut0FZD4z/KmPvXS8xzLxiF01fvSmH2sRSxilhXzo/fvAgowLoPdgOGM75EBo2HMw8TAbawQ5LksMmA73IpuNSVk6yl85gm",
  "q3sw2N5S+LXXUh3IfzNg9AVCRtq8RK03rboYWyNiY15S3yJko+dr1TdpLKYjXz7X9hU1UMZ43/KRyhZWdbIWyoK+khWNpFy8r1Nm",
  "eBOSNMXj82kfpe6J0jCgkqxz8of1A7auHqkglFqKw0EDxEFUR9vbaHzuWpbqhvQvMERGifr7Jboon9NZIak+yHlYpe8H7vHg3oR3",
  "NghqQkSOwXzp7juTreCzXbMR3NU3HTbWulf0RiYBAAAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCoGElxA6PFZajA",
  "bZkmArkW3AcC5sasnkGrMFSpg3RV9CVMjO0JqDXnoPa1HRfZSXIZcXGEGkDpjDIxtn+lSidcl+YCxB5wPRi4Yz1O33V8g78p4YCk",
  "sNqyHdWiUGTED2Ff4+lPGv0hm6uMO29VyE86V0w8WCPMFu4xogLxGyKk3wW23JXcZC1BoCxEoOqcoJaoOdZXhLmnCeAT0cOzC0W/",
  "1tT+SpnNdFFYqDtfBz1x4lLRfBdJBPWQi101Z5KdgkhHVeHPmgSBbCB9jD+y/k1YbxygMCDaGWg+N5QfCipAFv0BzdjvHNxFvh+l",
  "U6fGXV5uB5FwzdtOFEBzXvqV7RxRAgMBAAE=",
].join("");
const REAL_V3_PAIR_B64 = [
  "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",
].join("");

function u16(v: number): Uint8Array {
  return Uint8Array.of(v & 0xff, (v >> 8) & 0xff);
}
function u32(v: number): Uint8Array {
  return Uint8Array.of(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
}
function u64(v: number): Uint8Array {
  const lo = v >>> 0;
  const hi = Math.floor(v / 0x100000000);
  return Uint8Array.of(
    lo & 0xff,
    (lo >> 8) & 0xff,
    (lo >> 16) & 0xff,
    (lo >> 24) & 0xff,
    hi & 0xff,
    (hi >> 8) & 0xff,
    (hi >> 16) & 0xff,
    (hi >> 24) & 0xff,
  );
}
function cat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function lp(data: Uint8Array): Uint8Array {
  return cat(u32(data.length), data);
}

const SIG_MAGIC = new TextEncoder().encode("APK Sig Block 42");

/** Signer v2/v3 minimal : digests factices + UN blob (vrai cert ou déchet). */
function fakeSigner(certBlob: Uint8Array, scheme: "v2" | "v3"): Uint8Array {
  // digests : u32 longueur + entrées (u32 algo + u32 longueur + octets)
  const digestEntry = cat(u32(0x0103), lp(new Uint8Array(32).fill(0xab)));
  const digestsSeq = lp(digestEntry);
  // certificats : u32 longueur + (u32 longueur du cert + cert)
  const certsSeq = lp(lp(certBlob));
  // Attributs additionnels : c'est ICI que le v3 place minSdk/maxSdk
  // (et non en tête de signed data — le mettre en tête décalait tout
  // et cassait l'extraction sur les APK signés en v3).
  const attrs = scheme === "v3" ? lp(cat(u32(24), u32(0x7fffffff))) : lp(new Uint8Array(0));
  // signed data : digests + certificats + attributs
  const signedData = lp(cat(digestsSeq, certsSeq, attrs));
  // signer : signedData + signatures + clé publique
  return lp(cat(signedData, lp(new Uint8Array(0)), lp(new Uint8Array(0))));
}

/**
 * Faux APK : 1 fichier STORED + signing block multi-paires.
 * `pad16` réplique le layout réel (F-Droid, Facebook) : 16 zéros
 * devant size1, paires à +24 au lieu de +8. `withBlock = false`
 * produit un ZIP nu (aucun signe de signature) pour le refus brut.
 */
function fakeApkPairs(
  ids: number[],
  signers: Uint8Array[],
  pad16: boolean,
  withBlock = true,
  entryName = "hello.txt",
): Uint8Array {
  // Paire RÉELLE : u64 longueur (id + longueur de la valeur + valeur),
  // u32 id, u32 longueur de la valeur, valeur. La valeur est donc
  // elle-même préfixée par sa longueur — sans ce uint32, le contenu
  // est lu 4 octets de travers (le bug historique).
  const pairs = ids.map((id, i) => {
    const value = signers[i]!;
    return cat(u64(4 + 4 + value.length), u32(id), u32(value.length), value);
  });
  const pairFull = cat(...pairs);
  const block = !withBlock
    ? new Uint8Array(0)
    : pad16
      ? cat(
          new Uint8Array(16),
          u64(pairFull.length + 24),
          pairFull,
          u64(pairFull.length + 24),
          SIG_MAGIC,
        )
      : cat(u64(pairFull.length + 8), pairFull, u64(pairFull.length + 8), SIG_MAGIC);
  const name = new TextEncoder().encode(entryName);
  const data = new TextEncoder().encode("hello");
  const local = cat(
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(5),
    u32(5),
    u16(name.length),
    u16(0),
    name,
    data,
  );
  const cdEntry = cat(
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(5),
    u32(5),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    name,
  );
  const cdOffset = local.length + block.length;
  const eocd = cat(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(cdEntry.length),
    u32(cdOffset),
    u16(0),
  );
  return cat(local, block, cdEntry, eocd);
}

/** Faux APK : 1 fichier STORED + signing block (v2 ou v3) + vrai cert. */
function fakeApk(certDer: Uint8Array, scheme: "v2" | "v3"): Uint8Array {
  const id = scheme === "v3" ? 0xf05368c0 : 0x7109871a;
  return fakeApkPairs([id], [fakeSigner(certDer, scheme)], false);
}

/**
 * APK construit autour de paires BRUTES (octets réels) : le bloc n'est
 * pas réinterprété, il est simply réinjecté tel quel. Sert à rejouer
 * un vrai bloc de signature sans embarquer l'APK entier.
 */
function apkWithRawPairs(rawPairs: Uint8Array[]): Uint8Array {
  const pairFull = cat(...rawPairs);
  const block = cat(
    new Uint8Array(16),
    u64(pairFull.length + 24),
    pairFull,
    u64(pairFull.length + 24),
    SIG_MAGIC,
  );
  const name = new TextEncoder().encode("hello.txt");
  const data = new TextEncoder().encode("hello");
  const local = cat(
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(5),
    u32(5),
    u16(name.length),
    u16(0),
    name,
    data,
  );
  const cdEntry = cat(
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(5),
    u32(5),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
  );
  const cdOffset = local.length + block.length;
  const eocd = cat(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(cdEntry.length),
    u32(cdOffset),
    u16(0),
  );
  return cat(local, block, cdEntry, eocd);
}

/**
 * Vérifie l'extraction sur les APK synthétiques et, si disponible, F-Droid.
 * Contrôle aussi la normalisation du manifest et termine avec le code 1 en cas d'échec.
 */
async function main(): Promise<void> {
  const certDer = new Uint8Array(Buffer.from(FIXTURE_CERT_HEX, "hex"));
  console.log(`DER fixture: ${certDer.length} octets (attendu 866)`);
  if (certDer.length !== 866) {
    console.log("KO fixture DER tronqué");
    process.exit(1);
  }

  // 1. v2 synthétique : structure + SHA + sujet (cert réel).
  const v2 = await extractApkCerts(bufferReader(fakeApk(certDer, "v2")));
  check("v2 : 1 cert", v2.length === 1);
  check("v2 : scheme", v2[0]?.scheme === "v2");
  check("v2 : SHA croisé openssl", v2[0]?.sha256 === FIXTURE_SHA);
  check("v2 : CN", v2[0]?.subjectCn === "Ciaran Gultnieks");
  check("v2 : non-debug", v2[0]?.debug === false);

  // 2. v3 synthétique (min/maxSdk + même cert).
  const v3 = await extractApkCerts(bufferReader(fakeApk(certDer, "v3")));
  check("v3 : 1 cert", v3.length === 1);
  check("v3 : scheme", v3[0]?.scheme === "v3");
  check("v3 : SHA croisé openssl", v3[0]?.sha256 === FIXTURE_SHA);

  // 2b. Layout réel : pad16 (F-Droid, Facebook) → même résultat.
  const v2pad = await extractApkCerts(
    bufferReader(fakeApkPairs([0x7109871a], [fakeSigner(certDer, "v2")], true)),
  );
  check("pad16 : 1 cert", v2pad.length === 1);
  check("pad16 : SHA croisé openssl", v2pad[0]?.sha256 === FIXTURE_SHA);
  check("pad16 : CN", v2pad[0]?.subjectCn === "Ciaran Gultnieks");

  // 2c. Tolérance : v2 résiduel non-X.509 + v3 valide → le valide gagne
  // (cas réel : bloc v2 du vrai F-Droid, tranché via openssl).
  const garbage = new Uint8Array(264).fill(0xab);
  const mixed = await extractApkCerts(
    bufferReader(
      fakeApkPairs(
        [0x7109871a, 0xf05368c0],
        [fakeSigner(garbage, "v2"), fakeSigner(certDer, "v3")],
        false,
      ),
    ),
  );
  check("mixte : 1 cert", mixed.length === 1);
  check("mixte : schéma fort (v3)", mixed[0]?.scheme === "v3");
  check("mixte : SHA croisé openssl", mixed[0]?.sha256 === FIXTURE_SHA);

  // 2d. RÉGIME RÉEL : paires v2/v3 byte-exact (ketch + OnyxCalc).
  // Ces octets viennent d'APK réels signés : ils valident le format
  // APK tel qu'il existe, pas une approximation de test.
  const realV2 = await extractApkCerts(
    bufferReader(apkWithRawPairs([new Uint8Array(Buffer.from(REAL_V2_PAIR_B64, "base64"))])),
  );
  check("réel v2 : 1 cert", realV2.length === 1);
  check("réel v2 : schéma v2", realV2[0]?.scheme === "v2");
  check("réel v2 : CN=linroid", realV2[0]?.subjectCn === "linroid");
  check(
    "réel v2 : empreinte connue",
    realV2[0]?.sha256 === "3f512f48fea463e263766ee337cc88f254c9d92e773e18f436f159c308243d26",
  );
  const realV3 = await extractApkCerts(
    bufferReader(apkWithRawPairs([new Uint8Array(Buffer.from(REAL_V3_PAIR_B64, "base64"))])),
  );
  check("réel v3 : 1 cert", realV3.length === 1);
  check("réel v3 : schéma v3", realV3[0]?.scheme === "v3");
  check("réel v3 : CN=Onyx Calc", realV3[0]?.subjectCn === "Onyx Calc");
  check(
    "réel v3 : empreinte connue",
    realV3[0]?.sha256 === "f58efacd8c86687c7d4bff381f1bc3bc59dc1baf086c91fc1051d1e9852a7f45",
  );

  // 3. Refus francs : garbage + ZIP sans signature.
  let notZip = false;
  try {
    await extractApkCerts(bufferReader(new Uint8Array([1, 2, 3, 4])));
  } catch (e) {
    notZip = e instanceof ApkParseError && e.code === "NOT_ZIP";
  }
  check("garbage → NOT_ZIP", notZip);

  // 3a. ZIP nu (aucun signe de signature) → UNSIGNED brut (message l' фоне).
  let plainUnsigned = false;
  try {
    await extractApkCerts(bufferReader(fakeApkPairs([], [], false, false)));
  } catch (e) {
    plainUnsigned = e instanceof ApkParseError && e.code === "UNSIGNED";
  }
  check("zip sans bloc ni META-INF → UNSIGNED", plainUnsigned);

  // 3b. Bloc v2 présent mais signer = déchet → message différencié
  //     (le maker re-signe, il ne repart pas de zéro).
  let blockUnreadable = false;
  try {
    await extractApkCerts(
      bufferReader(fakeApkPairs([0x7109871a], [new Uint8Array(264).fill(0xab)], false)),
    );
  } catch (e) {
    blockUnreadable = e instanceof ApkParseError && e.code === "BLOCK_UNREADABLE";
  }
  check("bloc v2 déchet → BLOCK_UNREADABLE", blockUnreadable);

  // 3c. Magic de bloc valide mais aucune paire v2/v3 lisible (ex. id
  //     v3.1 0xf05368c1 seul — signé par des outils récents) →
  //     BLOCK_UNREADABLE, actionnable.
  let scheme31 = false;
  try {
    await extractApkCerts(
      bufferReader(fakeApkPairs([0xf05368c1], [fakeSigner(certDer, "v2")], false)),
    );
  } catch (e) {
    scheme31 = e instanceof ApkParseError && e.code === "BLOCK_UNREADABLE";
  }
  check("bloc v3.1 seul (id inconnu) → BLOCK_UNREADABLE", scheme31);

  // Blobs collectés mais aucun certificat lisible : CERT_FAILED, quel que soit le schéma.
  for (const scheme of ["v2", "v3"] as const) {
    let certFailed = false;
    try {
      await extractApkCerts(bufferReader(fakeApk(garbage, scheme)));
    } catch (e) {
      certFailed = e instanceof ApkParseError && e.code === "CERT_FAILED";
    }
    check(`${scheme} : blob non-X.509 → CERT_FAILED`, certFailed);
  }
  let v1CertFailed = false;
  try {
    await extractApkCerts(bufferReader(fakeApkPairs([], [], false, false, "META-INF/CERT.RSA")));
  } catch (e) {
    v1CertFailed = e instanceof ApkParseError && e.code === "CERT_FAILED";
  }
  check("v1 : bloc PKCS#7 illisible → CERT_FAILED", v1CertFailed);

  // 3b. Normalisation manifest : tout ce que la boîte noire peut cracher
  // se mappe vers du propre ou un refus franc (fonction pure testée offline).
  const nominal = normalizeManifestRaw({
    package: "com.example.app",
    versionCode: 42,
    versionName: "1.2.3",
    minSdkVersion: 24,
    targetSdkVersion: 34,
    usesPermissions: [
      "android.permission.INTERNET",
      { name: "android.permission.CAMERA" },
      "com.example.CUSTOM",
      42,
    ],
    application: { label: "Mon App", debuggable: false },
    icon: "data:image/png;base64,AAA",
  });
  check("manifest : package", nominal.package === "com.example.app");
  check("manifest : versions", nominal.versionCode === 42 && nominal.versionName === "1.2.3");
  check("manifest : sdk", nominal.minSdk === 24 && nominal.targetSdk === 34);
  check(
    "manifest : perms filtrées",
    nominal.permissions.length === 2 && nominal.permissions[0] === "android.permission.INTERNET",
  );
  check("manifest : label clair", nominal.label === "Mon App");
  check(
    "manifest : vc string",
    normalizeManifestRaw({ package: "a", versionCode: "7", versionName: "x" }).versionCode === 7,
  );
  check(
    "manifest : vc abc → refus",
    failsManifest({ package: "a", versionCode: "abc", versionName: "x" }),
  );
  check(
    "manifest : fallback packageName",
    normalizeManifestRaw({ packageName: "com.fb", versionCode: 1, versionName: "y" }).package ===
      "com.fb",
  );
  check("manifest : sans package → refus", failsManifest({ versionCode: 1, versionName: "y" }));
  check("manifest : sans version → refus", failsManifest({ package: "a", versionCode: 1 }));
  check(
    "manifest : label @string → null",
    normalizeManifestRaw({
      package: "a",
      versionCode: 1,
      versionName: "y",
      application: { label: "@string/app_name" },
    }).label === null,
  );
  check(
    "manifest : sans perms → []",
    normalizeManifestRaw({ package: "a", versionCode: 1, versionName: "y" }).permissions.length ===
      0,
  );
  check(
    "manifest : minSdk string → null",
    normalizeManifestRaw({ package: "a", versionCode: 1, versionName: "y", minSdkVersion: "24" })
      .minSdk === null,
  );
  check(
    "manifest : usesSdk niché",
    normalizeManifestRaw({
      package: "a",
      versionCode: 1,
      versionName: "y",
      usesSdk: { minSdkVersion: 21 },
    }).minSdk === 21,
  );
  check(
    "manifest : debuggable string → false",
    normalizeManifestRaw({
      package: "a",
      versionCode: 1,
      versionName: "y",
      application: { debuggable: "true" },
    }).debuggable === false,
  );
  check("manifest : raw null → refus", failsManifest(null));
  check(
    "manifest : icon vide → null",
    normalizeManifestRaw({ package: "a", versionCode: 1, versionName: "y", icon: "" })
      .iconBase64 === null,
  );

  // 4. Vrai APK F-Droid (téléchargé une fois, cache temp, SKIP sans réseau).
  const cachePath = join(tmpdir(), "mada-verify-fdroid.apk");
  let apkBytes: Uint8Array | null = null;
  if (existsSync(cachePath)) {
    apkBytes = new Uint8Array(readFileSync(cachePath));
  } else {
    try {
      const res = await fetch("https://f-droid.org/F-Droid.apk", {
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 1_000_000) {
          writeFileSync(cachePath, Buffer.from(ab));
          apkBytes = new Uint8Array(ab);
        }
      }
    } catch {
      // Pas de réseau : SKIP gracieux (comme les sections R2-gated).
    }
  }
  if (!apkBytes) {
    console.log("SKIP: vrai APK sans réseau");
  } else {
    const manifest = await extractApkManifest(cachePath);
    check("fdroid : package", manifest.package === "org.fdroid.fdroid");
    check("fdroid : versionCode > 0", manifest.versionCode > 0);
    check("fdroid : permissions", manifest.permissions.length > 0);
    const certs = await extractApkCerts(bufferReader(apkBytes));
    check("fdroid : ≥1 cert", certs.length >= 1);
    check(
      "fdroid : non-debug",
      certs.every((c) => !c.debug),
    );
    // Stabilité : 2 runs → même empreinte.
    const again = await extractApkCerts(bufferReader(apkBytes));
    check("fdroid : SHA stable", again[0]?.sha256 === certs[0]?.sha256);
  }

  console.log(`apk-extract: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`verify-apk-extract crash: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
