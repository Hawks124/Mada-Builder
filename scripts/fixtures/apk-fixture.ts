/**
 * Fixture APK partagée des verifies (D2/D3) : certificat PUBLIC F-Droid
 * (CIARANG, clé publique uniquement — aucun secret, SHA croisé openssl)
 * + mini-builder d'APK synthétique signé v2 (layout spec).
 * Duplique le hex de `verify-apk-extract.ts` à dessein : les scripts de
 * verify exécutent `main()` à l'import et ne peuvent pas se partager de
 * code. Source de vérité du hex : `ciarang.der` (866 octets).
 */
export const FIXTURE_CERT_HEX =
  "3082035e30820246a00302010202044c49cd00300d06092a864886f70d01010505003071310b300906035504061302554b3110300e06035504081307556e6b6e6f776e3111300f0603550407130857657468657262793110300e060355040a1307556e6b6e6f776e3110300e060355040b1307556e6b6e6f776e311930170603550403131043696172616e2047756c746e69656b73301e170d3130303732333137313032345a170d3337313230383137313032345a3071310b300906035504061302554b3110300e06035504081307556e6b6e6f776e3111300f0603550407130857657468657262793110300e060355040a1307556e6b6e6f776e3110300e060355040b1307556e6b6e6f776e311930170603550403131043696172616e2047756c746e69656b7330820122300d06092a864886f70d01010105000382010f003082010a028201010096d075e47c014e7822c89fd67f795d23203e2a8843f53ba4e6b1bf5f2fd0e225938267cfcae7fbf4fe596346afbaf4070fdb91f66fbcdf2348a3d92430502824f80517b156fab00809bdc8e631bfa9afd42d9045ab5fd6d28d9e140afc1300917b19b7c6c4df4a494cf1f7cb4a63c80d734265d735af9e4f09455f427aa65a53563f87b336ca2c19d244fcbba617ba0b19e56ed34afe0b253ab91e2fdb1271f1b9e3c3232027ed8862a112f0706e234cf236914b939bcf959821ecb2a6c18057e070de3428046d94b175e1d89bd795e535499a091f5bc65a79d539a8d43891ec504058acb28c08393b5718b57600a211e803f4a634e5c57f25b9b8c4422c6fd90203010001300d06092a864886f70d0101050500038201010008e4ef699e9807677ff56753da73efb2390d5ae2c17e4db691d5df7a7b60fc071ae509c5414be7d5da74df2811e83d3668c4a0b1abc84b9fa7d96b4cdf30bba68517ad2a93e233b042972ac0553a4801c9ebe07bf57ebe9a3b3d6d663965260e50f3b8f46db0531761e60340a2bddc3426098397fda54044a17e5244549f9869b460ca5e6e216b6f6a2db0580b480ca2afe6ec6b46eedacfa4aa45038809ece0c5978653d6c85f678e7f5a2156d1bedd8117751e64a4b0dcd140f3040b021821a8d93aed8d01ba36db6c82372211fed714d9a32607038cdfd565bd529ffc637212aaa2c224ef22b603eccefb5bf1e085c191d4b24fe742b17ab3f55d4e6f05ef";
export const FIXTURE_CERT_SHA = "43238d512c1e5eb2d6569f4a3afbf5523418b82e0a3ed1552770abb9a9c9ccab";

export function fixtureCertDer(): Uint8Array {
  return new Uint8Array(Buffer.from(FIXTURE_CERT_HEX, "hex"));
}

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

/**
 * APK synthétique minimal valide : 1 fichier STORED + signing block v2
 * (vrai cert) + central directory + EOCD. Passe `extractApkCerts`
 * (schéma v2, SHA croisé). Pour les tests record R2 (D3).
 */
export function fakeSignedApk(certDer: Uint8Array): Uint8Array {
  const digestEntry = cat(u32(1), lp(new Uint8Array(32).fill(0xab)));
  const signedData = lp(cat(lp(digestEntry), lp(lp(certDer))));
  const signer = lp(cat(signedData, lp(new Uint8Array(0)), lp(new Uint8Array(0))));
  const pair = cat(u32(0x7109871a), signer);
  const pairFull = cat(u64(pair.length), pair);
  const blockSize = pairFull.length + 8;
  const block = cat(
    u64(blockSize),
    pairFull,
    u64(blockSize),
    new TextEncoder().encode("APK Sig Block 42"),
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

/** Faux ZIP : magie PK mais pas d'EOCD (rejet NOT_ZIP attendu en D3). */
export function fakeUnsignedBytes(): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(1024, 7)]));
}
