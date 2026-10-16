/**
 * Chiffrement des clés de facturation (Phase 2 MRR, §16) : AES-256-GCM
 * via WebCrypto (Node 22 + Edge), IV aléatoire 12 o par chiffrement.
 *
 * Format stocké : `v1.<iv base64>.<ciphertext+tag base64>`.
 * Clé maître `REVENUE_KEY` (32 octets, base64 ou hex) — lue à l'usage,
 * jamais loggée, jamais retournée. Sans env (CI/build sans clés) :
 * `revenueCryptoConfigured()` = false et les fonctions lèvent une erreur
 * explicite (jamais de fallback non chiffré — fail closed).
 */

const PREFIX = "v1.";

function masterKey(): Uint8Array<ArrayBuffer> {
  const raw = (process.env.REVENUE_KEY ?? "").trim();
  let bytes: Uint8Array<ArrayBuffer> | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = Uint8Array.from(Buffer.from(raw, "hex"));
  } else if (raw !== "") {
    try {
      const decoded = Buffer.from(raw, "base64");
      if (decoded.length === 32) bytes = Uint8Array.from(decoded);
    } catch {
      bytes = null;
    }
  }
  if (!bytes || bytes.length !== 32) {
    throw new Error("REVENUE_KEY manquante ou invalide (32 octets, base64 ou hex).");
  }
  return bytes;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", masterKey(), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function revenueCryptoConfigured(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

function b64encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(s, "base64"));
}

/** Chiffre une clé provider (jamais de log de l'entrée — appelant responsable). */
export async function encryptRevenueKey(plaintext: string): Promise<string> {
  if (plaintext.trim() === "") throw new Error("Clé vide.");
  const key = await importKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return `${PREFIX}${b64encode(iv)}.${b64encode(cipher)}`;
}

/** Déchiffre un payload `v1.*` (erreur franche si format/clé incorrects). */
export async function decryptRevenueKey(payload: string): Promise<string> {
  if (!payload.startsWith(PREFIX)) throw new Error("Format de clé chiffrée inconnu.");
  const [, ivB64, cipherB64] = payload.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Format de clé chiffrée incomplet.");
  const key = await importKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(ivB64) },
    key,
    b64decode(cipherB64),
  );
  return new TextDecoder().decode(plain);
}

/** 4 derniers caractères (support/diagnostic — jamais la clé). */
export function revenueKeyHint(plaintext: string): string {
  const t = plaintext.trim();
  return t.length <= 4 ? "••••" : `…${t.slice(-4)}`;
}
