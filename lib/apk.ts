/**
 * Extraction APK côté client (D2) : manifest via `app-info-parser`
 * (vendored, pinné — voir D), certificats via parse maison (EOCD →
 * signing block v2/v3, blocs PKCS#7 v1), SHA via WebCrypto.
 * Zéro dépendance lourde, que des slices (`Blob.slice` : on ne charge
 * jamais les 150 Mo — EOCD + central directory + petits fichiers).
 * Erreurs franches à code machine (jamais de données fausses).
 */

export type ApkParseCode =
  | "NOT_ZIP"
  | "NO_MANIFEST"
  | "MANIFEST_FAILED"
  | "UNSIGNED"
  | "DEBUG_CERT"
  | "CERT_FAILED"
  | "TOO_BIG";

export class ApkParseError extends Error {
  readonly code: ApkParseCode;
  constructor(code: ApkParseCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type ApkManifest = {
  package: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  targetSdk: number | null;
  permissions: string[];
  label: string | null;
  debuggable: boolean;
  iconBase64: string | null;
};

export type ApkCert = {
  /** Schéma où le cert a été trouvé : v3 > v2 > v1 (priorité). */
  scheme: "v3" | "v2" | "v1";
  sha256: string;
  sha1: string;
  subjectCn: string | null;
  subjectO: string | null;
  issuerCn: string | null;
  serial: string;
  validFrom: string | null;
  validTo: string | null;
  sigAlg: string;
  keyAlg: string;
  keyBits: number | null;
  /** Certificat de debug Android (CN=Android Debug) — refusé comme Play. */
  debug: boolean;
};

export type ApkExtract = {
  manifest: ApkManifest;
  certs: ApkCert[];
  sha256File: string;
  sizeBytes: number;
};

// ── Utilitaires binaires ─────────────────────────────────────────────

const SIG_BLOCK_MAGIC = "APK Sig Block 42";
const SIG_V2 = 0x7109871a;
const SIG_V3 = 0xf05368c0;

function readU16LE(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}

function readU32LE(b: Uint8Array, o: number): number {
  // >>> 0 : résultat non signé — sans lui les `|` rendent un int32
  // signé et tout id ≥ 0x80000000 (ex. SIG_V3) rate son `===`.
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! * 0x1000000)) >>> 0;
}

function readU64LE(b: Uint8Array, o: number): number {
  const lo = readU32LE(b, o);
  const hi = readU32LE(b, o + 4);
  return hi * 0x100000000 + lo;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
}

async function sha1Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", data as unknown as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
}

// ── Signing block v2/v3 ──────────────────────────────────────────────

/** Certificats DER contenus dans un bloc PKCS#7 SignedData (v1 : *.RSA). */
export function certsOfPkcs7(der: Uint8Array): Uint8Array[] {
  const { node } = parseTlv(der, 0);
  if (node.tag !== 0x30 || node.children.length < 2) {
    throw new ApkParseError("CERT_FAILED", "Bloc PKCS#7 illisible.");
  }
  const content = req(node.children[1], "SignedData introuvable.");
  if (content.tag !== 0xa0 || content.children.length === 0) {
    throw new ApkParseError("CERT_FAILED", "SignedData introuvable.");
  }
  const signed = req(content.children[0], "SignedData introuvable.");
  const certs = signed.children.find((c) => c.tag === 0xa0);
  if (!certs || certs.children.length === 0) {
    throw new ApkParseError("CERT_FAILED", "Aucun certificat dans le bloc.");
  }
  // DER complets reconstruits (header tag+length + value). On ne peut
  // pas re-slicer : les `.slice()` copient, les offsets d'origine sont
  // perdus — le ré-encodage est exact (DER canonique court/long).
  return certs.children.map((cert) => encodeTlv(cert.tag, cert.value));
}

function encodeLengthBytes(len: number): Uint8Array {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function encodeTlv(tag: number, value: Uint8Array): Uint8Array {
  const len = encodeLengthBytes(value.length);
  const out = new Uint8Array(1 + len.length + value.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(value, 1 + len.length);
  return out;
}

/** Certificats DER d'un signer v2/v3 (sequence length-prefixed). */
function certsOfSigner(signer: Uint8Array, scheme: "v2" | "v3"): Uint8Array[] {
  let o = 0;
  const seqLen = ((): number => {
    const n = readU32LE(signer, o);
    o += 4;
    return n;
  })();
  void seqLen;
  if (scheme === "v3") {
    // v3 : minSdk + maxSdk (2× uint32) avant signedData.
    o += 8;
  }
  // signedData (length-prefixed) : digests, certificates, ...
  const signedLen = readU32LE(signer, o);
  o += 4;
  const signedEnd = o + signedLen;
  void signedEnd;
  // digests : sequence → skip (count + entrées length-prefixed).
  const digestsLen = readU32LE(signer, o);
  o += 4 + digestsLen;
  // certificates : sequence d'octets length-prefixed.
  const certsLen = readU32LE(signer, o);
  o += 4;
  const certsEnd = o + certsLen;
  const out: Uint8Array[] = [];
  while (o + 4 <= certsEnd) {
    const certLen = readU32LE(signer, o);
    o += 4;
    if (o + certLen > certsEnd) break;
    out.push(signer.slice(o, o + certLen));
    o += certLen;
  }
  return out;
}

// ── ASN.1 minimal (v1 PKCS#7 + X.509) ─────────────────────────────────

export type Tlv = { tag: number; value: Uint8Array; children: Tlv[]; start: number; total: number };

function readLength(b: Uint8Array, o: number): { length: number; next: number } {
  const first = b[o]!;
  if (first < 0x80) return { length: first, next: o + 1 };
  const n = first & 0x7f;
  if (n === 0 || n > 4) throw new ApkParseError("CERT_FAILED", "Longueur DER non supportée.");
  let length = 0;
  for (let i = 0; i < n; i++) length = length * 256 + b[o + 1 + i]!;
  return { length, next: o + 1 + n };
}

/** Parse TLV DER (exporté pour les tests) — throw ApkParseError si tronqué. */
export function parseTlv(b: Uint8Array, o: number): { node: Tlv; next: number } {
  const tag = b[o]!;
  const { length, next } = readLength(b, o + 1);
  const value = b.slice(next, next + length);
  const children: Tlv[] = [];
  if ((tag & 0x20) !== 0) {
    let p = 0;
    while (p < value.length) {
      try {
        const r = parseTlv(value, p);
        children.push(r.node);
        p = r.next;
      } catch {
        break;
      }
    }
  }
  return {
    node: { tag, value, children, start: o, total: next + length - o },
    next: next + length,
  };
}

function oidToString(b: Uint8Array): string {
  if (b.length === 0) return "";
  const parts = [Math.floor(b[0]! / 40), b[0]! % 40];
  let v = 0;
  for (let i = 1; i < b.length; i++) {
    v = v * 128 + (b[i]! & 0x7f);
    if ((b[i]! & 0x80) === 0) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

const SIG_ALG_NAMES: Record<string, string> = {
  "1.2.840.113549.1.1.2": "md2RSA",
  "1.2.840.113549.1.1.4": "md5RSA",
  "1.2.840.113549.1.1.5": "sha1RSA",
  "1.2.840.113549.1.1.11": "sha256RSA",
  "1.2.840.113549.1.1.12": "sha384RSA",
  "1.2.840.113549.1.1.13": "sha512RSA",
  "1.2.840.10045.4.3.2": "ecdsa-sha256",
  "1.2.840.10045.4.3.3": "ecdsa-sha384",
  "1.2.840.10045.4.3.4": "ecdsa-sha512",
  "1.2.840.10046.2.1": "dsa-sha256",
  "1.2.840.10040.4.2": "dsa-sha1",
  "1.2.840.10040.4.3": "dsa-sha256",
};

const ATTR_NAMES: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
};

function textOf(node: Tlv): string {
  if (
    node.tag === 0x13 ||
    node.tag === 0x0c ||
    node.tag === 0x16 ||
    node.tag === 0x1e ||
    node.tag === 0x17 ||
    node.tag === 0x18
  ) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(node.value);
    } catch {
      return "";
    }
  }
  return "";
}

/** Parse un Name X.509 → {CN, O, ...}. */
function parseName(node: Tlv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rdn of node.children) {
    const seqs = rdn.tag === 0x31 ? rdn.children : [rdn];
    for (const atv of seqs) {
      if (atv.children.length >= 2) {
        const oid = oidToString(atv.children[0]!.value);
        const name = ATTR_NAMES[oid];
        if (name) out[name] = textOf(atv.children[1]!);
      }
    }
  }
  return out;
}

function parseTime(node: Tlv): string | null {
  const s = textOf(node);
  if (!s) return null;
  try {
    if (node.tag === 0x17 && s.length >= 13) {
      const yy = Number(s.slice(0, 2));
      const full = yy >= 50 ? 1900 + yy : 2000 + yy;
      return new Date(
        Date.UTC(
          full,
          Number(s.slice(2, 4)) - 1,
          Number(s.slice(4, 6)),
          Number(s.slice(6, 8)),
          Number(s.slice(8, 10)),
          Number(s.slice(10, 12)),
        ),
      ).toISOString();
    }
    if (node.tag === 0x18 && s.length >= 14) {
      return new Date(
        Date.UTC(
          Number(s.slice(0, 4)),
          Number(s.slice(4, 6)) - 1,
          Number(s.slice(6, 8)),
          Number(s.slice(8, 10)),
          Number(s.slice(10, 12)),
          Number(s.slice(12, 14)),
        ),
      ).toISOString();
    }
  } catch {
    return null;
  }
  return null;
}

function intHex(node: Tlv): string {
  let hex = bytesToHex(node.value).replace(/^0+(?=[0-9a-f])/i, "");
  if (hex === "") hex = "0";
  return `0x${hex}`;
}

/** Accès défensif : erreur franche au lieu de TypeError. */
function req<T>(v: T | undefined, message: string): T {
  if (v === undefined) throw new ApkParseError("CERT_FAILED", message);
  return v;
}

function keyBits(spki: Tlv): { alg: string; bits: number | null } {
  if (spki.children.length < 2) return { alg: "?", bits: null };
  const algOid = spki.children[0]!.children[0]
    ? oidToString(spki.children[0]!.children[0]!.value)
    : "";
  if (algOid === "1.2.840.113549.1.1.1") {
    // RSA : BIT STRING → SEQUENCE → modulus INTEGER.
    try {
      const bitStr = spki.children[1]!;
      const inner = parseTlv(bitStr.value, bitStr.value[0] === 0 ? 1 : 0).node;
      const modulus = inner.children[0]!;
      let bytes = modulus.value;
      if (bytes[0] === 0) bytes = bytes.slice(1);
      return { alg: "RSA", bits: bytes.length * 8 };
    } catch {
      return { alg: "RSA", bits: null };
    }
  }
  if (algOid === "1.2.840.10045.2.1") {
    const curve = spki.children[0]!.children[1]
      ? oidToString(spki.children[0]!.children[1]!.value)
      : "";
    const bits =
      curve === "1.2.840.10045.3.1.7"
        ? 256
        : curve === "1.3.132.0.34"
          ? 384
          : curve === "1.3.132.0.35"
            ? 521
            : null;
    return { alg: "EC", bits };
  }
  if (algOid === "1.2.840.10040.4.1") {
    // DSA : params SEQUENCE { P, Q, G } → taille = P sans zéro de tête.
    try {
      const params = spki.children[0]!.children[1]!;
      const p = req(params.children[0], "Paramètre P manquant.");
      let bytes = p.value;
      if (bytes[0] === 0) bytes = bytes.slice(1);
      return { alg: "DSA", bits: bytes.length * 8 };
    } catch {
      return { alg: "DSA", bits: null };
    }
  }
  return { alg: algOid || "?", bits: null };
}

/** Détails d'un certificat DER X.509 (v1 PKCS#7 ou v2/v3). */
async function certDetails(der: Uint8Array, scheme: ApkCert["scheme"]): Promise<ApkCert> {
  const { node } = parseTlv(der, 0);
  if (node.tag !== 0x30 || node.children.length < 3) {
    throw new ApkParseError("CERT_FAILED", "Certificat X.509 illisible.");
  }
  const tbs = node.children[0]!;
  const tbsChildren = tbs.children.filter(
    (c) => c.tag === 0x30 || c.tag === 0x02 || c.tag === 0xa0,
  );
  // [version EXPLICIT], serial, signature, issuer, validity, subject, spki
  let i = 0;
  if (tbsChildren.length < 6) throw new ApkParseError("CERT_FAILED", "TBSCertificate incomplet.");
  if (tbsChildren[i]!.tag === 0xa0) i++;
  const serial = intHex(req(tbsChildren[i++], "Serial manquant."));
  const sigAlg = oidToString(
    req(req(tbsChildren[i++], "Algorithme manquant.").children[0], "OID manquant.").value,
  );
  const issuer = parseName(req(tbsChildren[i++], "Issuer manquant."));
  const validity = req(tbsChildren[i++], "Validité manquante.");
  const subject = parseName(req(tbsChildren[i++], "Subject manquant."));
  const spki = req(tbsChildren[i], "Clé publique manquante.");
  const { alg, bits } = keyBits(spki);
  const [sha256, sha1] = await Promise.all([sha256Hex(der), sha1Hex(der)]);
  const cn = subject["CN"] ?? null;
  const debug = cn === "Android Debug";
  return {
    scheme,
    sha256,
    sha1,
    subjectCn: cn,
    subjectO: subject["O"] ?? null,
    issuerCn: issuer["CN"] ?? null,
    serial,
    validFrom: validity.children[0] ? parseTime(validity.children[0]) : null,
    validTo: validity.children[1] ? parseTime(validity.children[1]) : null,
    sigAlg: SIG_ALG_NAMES[sigAlg] ?? sigAlg,
    keyAlg: alg,
    keyBits: bits,
    debug,
  };
}

// ── Entrées ZIP (v1 : META-INF/*.RSA) ─────────────────────────────────

export type ZipEntry = { name: string; compressedSize: number; dataOffset: number; method: number };

/** Entrées d'un central directory déjà slicé (offsets absolus conservés). */
export function listZipEntries(cdBuf: Uint8Array, count: number): ZipEntry[] {
  const out: ZipEntry[] = [];
  let o = 0;
  for (let i = 0; i < count; i++) {
    if (o + 46 > cdBuf.length) break;
    if (readU32LE(cdBuf, o) !== 0x02014b50) break;
    const method = readU16LE(cdBuf, o + 10);
    const compSize = readU32LE(cdBuf, o + 24);
    const nameLen = readU16LE(cdBuf, o + 28);
    const extraLen = readU16LE(cdBuf, o + 30);
    const commentLen = readU16LE(cdBuf, o + 32);
    const localOffset = readU32LE(cdBuf, o + 42);
    const name = String.fromCharCode(...cdBuf.slice(o + 46, o + 46 + nameLen));
    out.push({ name, compressedSize: compSize, dataOffset: localOffset, method });
    o += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Octets d'une entrée ZIP via son local header (offsets absolus).
 * STORED = slice direct ; DEFLATED = `DecompressionStream` natif
 * (navigateur + Node 18+, zéro dépendance — les .RSA sont souvent
 * déflatés, ex. clé F-Droid). Autres méthodes = refus franc. */
export async function readStoredEntry(read: SliceReader, entry: ZipEntry): Promise<Uint8Array> {
  const head = await read.slice(entry.dataOffset, entry.dataOffset + 30);
  if (readU32LE(head, 0) !== 0x04034b50) {
    throw new ApkParseError("CERT_FAILED", "Local header invalide.");
  }
  const nameLen = readU16LE(head, 26);
  const extraLen = readU16LE(head, 28);
  const start = entry.dataOffset + 30 + nameLen + extraLen;
  // Certificats < 10 Ko en pratique : cap identique aux deux branches
  // (jamais d'allocation géante sur taille déclarée mensongère).
  if (entry.compressedSize <= 0 || entry.compressedSize > 100_000) {
    throw new ApkParseError("CERT_FAILED", "Taille d'entrée suspecte.");
  }
  if (entry.method === 0) {
    return read.slice(start, start + entry.compressedSize);
  }
  if (entry.method === 8) {
    const out = await withTimeoutMs(
      (async () => {
        const raw = await read.slice(start, start + entry.compressedSize);
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        await writer.write(raw as unknown as ArrayBuffer);
        await writer.close();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.length;
          if (total > 10_000_000)
            throw new ApkParseError("CERT_FAILED", "Sortie décompression suspecte.");
        }
        const out = new Uint8Array(total);
        let o = 0;
        for (const c of chunks) {
          out.set(c, o);
          o += c.length;
        }
        return out;
      })(),
      15000,
      `inflate ${entry.name}`,
    );
    return out;
  }
  throw new ApkParseError(
    "CERT_FAILED",
    `Méthode ZIP ${entry.method} non supportée (${entry.name}).`,
  );
}

/**
 * Garde anti-pendaison (D6) : un inflate qui ne termine pas (stream
 * exotique, stall navigateur) devient une erreur franche — l'appelant
 * ignore l'entrée (v2/v3 font foi) au lieu de spinner à vie.
 */
function withTimeoutMs<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new ApkParseError("CERT_FAILED", `Délai dépassé (${label}).`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t !== undefined) clearTimeout(t);
  });
}

// ── API haut niveau ──────────────────────────────────────────────────

export type SliceReader = {
  size: number;
  slice(start: number, end: number): Promise<Uint8Array>;
};

/** Lecteur sur Blob/File (navigateur) : que des tranches, jamais tout. */
export function blobReader(blob: Blob): SliceReader {
  return {
    size: blob.size,
    slice: async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer()),
  };
}

/** Lecteur sur buffer complet (Node/verify, fichiers de test). */
export function bufferReader(buf: Uint8Array): SliceReader {
  return {
    size: buf.length,
    slice: async (start, end) => buf.slice(Math.max(0, start), Math.min(end, buf.length)),
  };
}

/**
 * Certificats DER de TOUS les schémas (v3 > v2 > v1). En-tête + EOCD +
 * signing block + petits META-INF : quelques dizaines de Ko lus même
 * sur 150 Mo — jamais le fichier entier, jamais d'allocation géante.
 */
export async function extractCertDers(
  read: SliceReader,
): Promise<Array<{ scheme: ApkCert["scheme"]; der: Uint8Array }>> {
  // EOCD : 64 Ko de queue suffisent (commentaire max 65535 + 22).
  const tailSize = Math.min(read.size, 66000);
  const tailBase = read.size - tailSize;
  const tail = await read.slice(tailBase, read.size);
  const start = Math.max(0, tail.length - 65558);
  let rel = -1;
  for (let i = tail.length - 22; i >= start; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      rel = i;
      break;
    }
  }
  if (rel < 0) throw new ApkParseError("NOT_ZIP", "Archive ZIP illisible (EOCD introuvable).");
  const eocdAbs = tailBase + rel;
  const eocdBuf = await read.slice(eocdAbs, eocdAbs + 22);
  const cdOffset = readU32LE(eocdBuf, 16);
  const cdSize = readU32LE(eocdBuf, 12);
  const out: Array<{ scheme: ApkCert["scheme"]; der: Uint8Array }> = [];

  // Signing block v2/v3 : juste avant le central directory.
  if (cdOffset >= 32 && cdOffset <= read.size) {
    const probe = await read.slice(cdOffset - 32, cdOffset);
    const magic = String.fromCharCode(...probe.slice(16, 32));
    if (magic === SIG_BLOCK_MAGIC) {
      const blockSize = readU64LE(probe, 8);
      const blockStart = cdOffset - 24 - blockSize;
      if (blockStart >= 0 && blockSize < 50_000_000) {
        const blockBuf = await read.slice(blockStart, cdOffset - 24);
        // Position des paires : +8 en spec, mais des outils réels
        // insèrent 16 octets de zéros devant (constaté sur F-Droid
        // et Facebook : v2/v3/Brew chaînés à +24, fin exacte).
        // On essaie chaque candidat, spec d'abord.
        const end = blockBuf.length;
        for (const start of [8, 16, 24]) {
          let o = start;
          let found = false;
          while (o + 12 <= end) {
            const pairSize = readU64LE(blockBuf, o);
            const id = readU32LE(blockBuf, o + 8);
            if (pairSize < 4 || o + 8 + pairSize > end) break;
            const value = blockBuf.slice(o + 12, o + 8 + pairSize);
            if (id === SIG_V2 || id === SIG_V3) {
              const scheme = id === SIG_V3 ? "v3" : "v2";
              for (const der of certsOfSigner(value, scheme)) {
                out.push({ scheme, der });
                found = true;
              }
            }
            o += 8 + pairSize;
          }
          if (found) break;
        }
      }
    }
  }

  // v1 : META-INF/*.RSA (petits fichiers, lus par tranches).
  if (cdSize > 0 && cdSize < 20_000_000 && cdOffset + cdSize <= read.size) {
    const cdBuf = await read.slice(cdOffset, cdOffset + cdSize);
    const entryCount = readU16LE(eocdBuf, 10);
    for (const entry of listZipEntries(cdBuf, entryCount)) {
      const upper = entry.name.toUpperCase();
      if (
        upper.startsWith("META-INF/") &&
        (upper.endsWith(".RSA") || upper.endsWith(".DSA") || upper.endsWith(".EC")) &&
        entry.compressedSize > 0 &&
        entry.compressedSize < 100_000
      ) {
        try {
          const data = await readStoredEntry(read, entry);
          // Bloc PKCS#7 : on garde le DER brut (le parse ASN.1 suit).
          out.push({ scheme: "v1", der: data });
        } catch {
          // Entrée illisible : on ignore (v2/v3 font foi si présents).
        }
      }
    }
  }
  return out;
}

/**
 * Certificats complets : parse ASN.1 + empreintes, dédupliqués par SHA-256
 * (un même cert peut apparaître en v1 + v2 — on garde le schéma le plus
 * fort : v3 > v2 > v1). Vide = non signé → refus (`UNSIGNED`).
 * Tolérance par blob : un signer résiduel non-X.509 (constaté : bloc v2
 * du vrai F-Droid) est ignoré tant qu'un autre schéma donne un cert
 * valide — sinon on rejetterait des apps légitimes. Zéro cert valide
 * au total → `UNSIGNED` (fail-closed).
 */
export async function extractApkCerts(read: SliceReader): Promise<ApkCert[]> {
  const raw = await extractCertDers(read);
  if (raw.length === 0) {
    throw new ApkParseError("UNSIGNED", "APK non signé — signature requise.");
  }
  const order = { v3: 0, v2: 1, v1: 2 } as const;
  const sorted = [...raw].sort((a, b) => order[a.scheme] - order[b.scheme]);
  const seen = new Set<string>();
  const out: ApkCert[] = [];
  for (const { scheme, der } of sorted) {
    let ders: Uint8Array[];
    try {
      ders = scheme === "v1" ? certsOfPkcs7(der) : [der];
    } catch {
      continue; // Bloc PKCS#7 illisible : on ignore ce blob.
    }
    for (const d of ders) {
      let cert: ApkCert;
      try {
        cert = await certDetails(d, scheme);
      } catch {
        continue; // Blob non-X.509 (résidu d'outil) : on ignore.
      }
      if (seen.has(cert.sha256)) continue;
      seen.add(cert.sha256);
      out.push(cert);
    }
  }
  if (out.length === 0) {
    throw new ApkParseError("UNSIGNED", "APK non signé — signature requise.");
  }
  return out;
}

// ── Manifest (app-info-parser, vendored) ─────────────────────────────

type RawManifest = {
  package?: unknown;
  packageName?: unknown;
  versionCode?: unknown;
  versionName?: unknown;
  minSdkVersion?: unknown;
  targetSdkVersion?: unknown;
  usesSdk?: { minSdkVersion?: unknown; targetSdkVersion?: unknown };
  usesPermissions?: unknown;
  application?: { label?: unknown };
  label?: unknown;
  icon?: unknown;
};

/**
 * Manifest via app-info-parser (dynamic import : charge seulement le
 * module APK, au moment du parse). Import PROFOND `src/apk.js` (pas
 * l'index) : l'index tire `ipa.js → bplist-parser → fs`, impossible
 * côté navigateur. `source` = File/Blob (navigateur) ou chemin (Node).
 * Labels `@string/…` non résolus → null (jamais de faux texte).
 */
export async function extractApkManifest(source: Blob | string): Promise<ApkManifest> {
  let raw: RawManifest;
  try {
    const mod = (await import("app-info-parser/src/apk.js")) as unknown as {
      default?: new (f: Blob | string) => { parse(): Promise<unknown> };
    };
    const Ctor =
      mod.default ?? (mod as unknown as new (f: Blob | string) => { parse(): Promise<unknown> });
    raw = (await new Ctor(source).parse()) as RawManifest;
  } catch (e) {
    throw new ApkParseError(
      "MANIFEST_FAILED",
      `Manifest illisible : ${e instanceof Error ? e.message.slice(0, 120) : "erreur inconnue"}`,
    );
  }
  return normalizeManifestRaw(raw);
}
/**
 * Normalisation pure d'un manifest brut (tel que craché par
 * app-info-parser) → `ApkManifest`. Exportée pour les tests : tout ce
 * que la boîte noire peut produire (champs manquants, types exotiques,
 * labels `@string/…`, permissions custom) se mappe vers des données
 * propres ou un refus franc — jamais de données fausses.
 */
export function normalizeManifestRaw(input: unknown): ApkManifest {
  const raw = (input ?? {}) as RawManifest;
  const packageName =
    typeof raw.package === "string"
      ? raw.package
      : typeof raw.packageName === "string"
        ? raw.packageName
        : null;
  const versionCode =
    typeof raw.versionCode === "number" ? raw.versionCode : Number(raw.versionCode);
  const versionName =
    typeof raw.versionName === "string" ? raw.versionName : String(raw.versionName ?? "");
  const minSdk =
    typeof raw.minSdkVersion === "number"
      ? raw.minSdkVersion
      : typeof raw.usesSdk?.minSdkVersion === "number"
        ? raw.usesSdk.minSdkVersion
        : null;
  const targetSdk =
    typeof raw.targetSdkVersion === "number"
      ? raw.targetSdkVersion
      : typeof raw.usesSdk?.targetSdkVersion === "number"
        ? raw.usesSdk.targetSdkVersion
        : null;
  if (!packageName || !Number.isInteger(versionCode) || !versionName) {
    throw new ApkParseError("MANIFEST_FAILED", "Manifest incomplet (package/version illisibles).");
  }
  const perms = Array.isArray(raw.usesPermissions) ? raw.usesPermissions : [];
  const permissions = perms
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string") {
        return (p as { name: string }).name;
      }
      return null;
    })
    .filter((p): p is string => p !== null && p.startsWith("android.permission."));
  const appLabel =
    raw.application && typeof raw.application === "object"
      ? (raw.application as { label?: unknown }).label
      : raw.label;
  const label = typeof appLabel === "string" && !appLabel.startsWith("@") ? appLabel : null;
  const appDebug =
    raw.application && typeof raw.application === "object"
      ? (raw.application as { debuggable?: unknown }).debuggable
      : undefined;
  return {
    package: packageName,
    versionCode,
    versionName,
    minSdk,
    targetSdk,
    permissions,
    label,
    debuggable: appDebug === true,
    iconBase64: typeof raw.icon === "string" && raw.icon.length > 0 ? raw.icon : null,
  };
}
