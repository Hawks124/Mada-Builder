import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { captureError } from "@/lib/monitoring";
import type { SliceReader } from "@/lib/apk";
import { MAX_APK_BYTES } from "@/lib/apk-limits";

/**
 * Médias produits sur Cloudflare R2 (S3-compatible) — PAS Supabase
 * Storage (décision) : pas d'egress fees, buckets séparés logos/shots.
 *
 * - Clés serveur seules (jamais côté client, jamais en log) ; enforcement
 *   100 % applicatif (R2 n'a pas de RLS : ownership + validation Zod +
 *   magic-bytes AVANT upload, comme avatars).
 * - Buckets publics en lecture (URLs stables, style RACINE par bucket :
 *   `{base}/{key}`, jamais `/{bucket}/` — les domaines `*.r2.dev` sont
 *   par bucket). Dev = r2.dev, prod = un domaine custom par bucket
 *   (mêmes vars, valeurs différentes — voir .env.example).
 *   Repli legacy : base unique + `/{bucket}/{key}` (CDN avec routage par
 *   chemin — inactif sauf `R2_PUBLIC_PATH_STYLE=true`).
 * - Uploads en `Cache-Control: public, max-age=31536000, immutable`
 *   (hashés par uid).
 * - Client lazy singleton (même pattern que db) : import inoffensif sans
 *   clés (contributeur sans backend, CI sans secrets).
 */

export const PRODUCT_LOGOS_BUCKET = "product-logos";
export const PRODUCT_SHOTS_BUCKET = "product-shots";
/** Builds APK (D1) : bucket PRIVÉ (jamais d'URL publique directe — les
 * téléchargements passent par des URL GET signées à la demande, et
 * seulement pour les builds approuvés). Provisionné par scripts/r2-setup. */
export const PRODUCT_BUILDS_BUCKET = "product-builds";

/** Type MIME imposé aux APK (présignature + PUT client). */
export const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

/** APK Android (D1) : seul format accepté (universel — splits et AAB
 * refusés avec doc, voir milestone D). Quota verrouillé à la signature
 * (S3 vérifie Content-Length au PUT) + re-vérifié au HEAD post-upload.
 * Valeur : source unique lib/apk-limits (300 Mo, borne RAM/réseau). */
export const MAX_BUILD_BYTES = MAX_APK_BYTES;

let client: S3Client | null | undefined;
function r2(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 non configuré — voir .env.example (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).",
    );
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  );
}

function publicBaseFor(bucket: string): string {
  const perBucket =
    bucket === PRODUCT_LOGOS_BUCKET
      ? process.env.R2_PUBLIC_LOGOS_BASE
      : bucket === PRODUCT_SHOTS_BUCKET
        ? process.env.R2_PUBLIC_SHOTS_BASE
        : undefined;
  // Convention repo (bases par bucket) + repli convention existante
  // (base unique, déjà en place).
  const base = (perBucket ?? process.env.R2_PUBLIC_BASE ?? process.env.R2_PUBLIC_URL ?? "").replace(
    /\/+$/,
    "",
  );
  if (!base) {
    throw new Error("R2_PUBLIC_LOGOS_BASE / R2_PUBLIC_SHOTS_BASE manquantes — voir .env.example.");
  }
  return base;
}

/** URL publique d'une clé (backfill + vérifications — même construction). */
export function r2PublicUrl(bucket: string, key: string): string {
  return publicUrl(bucket, key);
}

/**
 * Garde post-upload : l'URL stockée DOIT répondre (HEAD 5 s). Sinon la
 * fiche naît cassée en silence (accès public manquant, base erronée) —
 * erreur franche à la place. Best-effort réseau, stricte sur le statut.
 */
export async function assertR2Public(url: string, label: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error(`${label} : image injoignable — accès public du bucket à vérifier.`);
  }
  if (!res.ok) {
    throw new Error(
      `${label} : image injoignable (HTTP ${res.status}) — accès public du bucket à vérifier.`,
    );
  }
}

function publicUrl(bucket: string, key: string): string {
  const base = publicBaseFor(bucket);
  // r2.dev et domaines par bucket = style racine. Legacy (CDN avec
  // routage par chemin) uniquement sur opt-in explicite.
  if (process.env.R2_PUBLIC_PATH_STYLE === "true") {
    return `${base}/${bucket}/${key}`;
  }
  return `${base}/${key}`;
}

export type R2Bucket = typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET;

/** Upload bytes déjà validés (magic-bytes + taille, côté service). */ export async function putR2Object(
  bucket: R2Bucket,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  try {
    await r2().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "r2.put" });
    throw new Error("Upload impossible pour le moment.");
  }
  return publicUrl(bucket, key);
}

/** Suppression best-effort (jamais bloquante — le bloat se purge au cron). */
export async function deleteR2Object(bucket: string, key: string): Promise<void> {
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "r2.delete" });
  }
}

/** Clé déterministe `{productId}/{kind}-{stamp}-{rand}.{ext}` (anti-collision
 * même milliseconde : deux uploads simultanés du même slot). */
export function r2Key(productId: string, kind: "logo" | `shot-${number}`, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${productId}/${kind}-${Date.now()}-${rand}.${ext}`;
}

/**
 * Liste les clés d'un bucket (pagination interne, cap de sécurité).
 * Sert au balayeur d'orphelins — jamais en chemin chaud.
 * `prefix` optionnel (ex. `builds/{maker}/{produit}/` pour une purge
 * ciblée) — bucket en `string` car les privés n'ont pas de type dédié.
 */
export async function listR2Keys(
  bucket: string,
  maxKeys = 5000,
  prefix?: string,
): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
        ...(prefix ? { Prefix: prefix } : {}),
      }),
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push(o.Key);
      if (out.length >= maxKeys) return out;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** Extensions servies par le flow présigné (contenu réel re-validé au submit). */
export const STAGED_EXTS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

/**
 * URL présignée PUT (Phase 6) : le mobile uploade le brut DIRECTEMENT
 * (zéro RAM serveur) vers `staging/{maker}/{stamp}-{rand}.{ext}`. Taille
 * et type vérifiés AVANT signature (jamais de promesse aveugle).
 * Validité courte (10 min) : une clé volée expire vite.
 */
export async function presignStagingUpload(input: {
  bucket: R2Bucket;
  makerId: string;
  contentType: string;
  contentLength: number;
}): Promise<{ url: string; key: string }> {
  const ext = (STAGED_EXTS as Record<string, string>)[input.contentType];
  if (!ext) throw new Error("Type de fichier refusé (PNG, JPG, WebP uniquement).");
  if (!Number.isFinite(input.contentLength) || input.contentLength <= 0) {
    throw new Error("Taille de fichier illisible.");
  }
  if (input.contentLength > 10 * 1024 * 1024) {
    throw new Error("Fichier trop lourd (10 Mo maximum).");
  }
  if (!/^[0-9a-f-]{36}$/.test(input.makerId)) throw new Error("Maker invalide.");
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `staging/${input.makerId}/${Date.now()}-${rand}.${ext}`;
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    { expiresIn: 600 },
  );
  return { url, key };
}

/** Télécharge des bytes R2 (staging → pipeline de validation). */
export async function getR2Object(bucket: R2Bucket, key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error("Objet vide.");
  return Buffer.from(await body.transformToByteArray());
}

/**
 * Flux lecture R2 (export ZIP : pipe sans buffering — un APK de 300 Mo
 * ne doit jamais tenir en RAM serveur). Erreur si absent.
 */
export async function getR2ObjectStream(
  bucket: string,
  key: string,
): Promise<import("node:stream").Readable> {
  const { Readable } = await import("node:stream");
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error("Objet vide.");
  const web = body.transformToWebStream();
  return Readable.fromWeb(web as never);
}

/**
 * Métadonnées d'un objet (taille + type) sans le télécharger — garde
 * post-upload des builds (le PUT présigné déclare, le HEAD prouve).
 * Retourne null si absent (jamais de throw pour un 404).
 */
export async function headR2Object(
  bucket: string,
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      size: typeof res.ContentLength === "number" ? res.ContentLength : -1,
      contentType: res.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * URL présignée PUT pour un build APK (D1) : le maker PUT le binaire
 * DIRECTEMENT (zéro RAM serveur, jamais via Vercel — limite 4,5 Mo).
 * Quota 300 Mo + type APK vérifiés AVANT signature ; clé confinée à
 * `builds/{maker}/{product}/` ; validité 15 min (gros fichiers).
 */
export async function presignBuildUpload(input: {
  makerId: string;
  productId: string;
  contentLength: number;
}): Promise<{ url: string; key: string }> {
  if (!/^[0-9a-f-]{36}$/.test(input.makerId)) throw new Error("Maker invalide.");
  if (!/^[0-9a-f-]{36}$/.test(input.productId)) throw new Error("Produit invalide.");
  if (!Number.isFinite(input.contentLength) || input.contentLength <= 0) {
    throw new Error("Taille de fichier illisible.");
  }
  if (input.contentLength > MAX_BUILD_BYTES) {
    throw new Error("APK trop lourd (300 Mo maximum).");
  }
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `builds/${input.makerId}/${input.productId}/${Date.now()}-${rand}.apk`;
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: PRODUCT_BUILDS_BUCKET,
      Key: key,
      ContentType: APK_CONTENT_TYPE,
      ContentLength: input.contentLength,
    }),
    { expiresIn: 900 },
  );
  return { url, key };
}

/**
 * URL GET signée courte pour télécharger un build (revue admin, fiche,
 * mobile) : le bucket builds est PRIVÉ, jamais d'URL publique directe.
 * La clé DOIT vivre sous `builds/` (jamais d'ailleurs).
 */
export async function presignBuildDownload(key: string): Promise<string> {
  if (!key.startsWith("builds/") || key.includes("..")) {
    throw new Error("Clé de build invalide.");
  }
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: PRODUCT_BUILDS_BUCKET, Key: key }), {
    expiresIn: 300,
  });
}

// ── Multipart resumable (D6) ─────────────────────────────────────────
// Uploads > seuil en parts de 8 Mo, chacune retryable et reprenable.
// Le client ne charge jamais tout en RAM (Blob.slice) ; le serveur ne
// voit jamais un octet (que des URLs présignées + composition finale).
// L'objet composé est un objet normal : HEAD, Range et record inchangés.

export type MultipartPart = { n: number; etag: string; size: number };

function assertBuildKey(makerId: string, productId: string, key: string): void {
  if (!/^[0-9a-f-]{36}$/.test(makerId)) throw new Error("Maker invalide.");
  if (!/^[0-9a-f-]{36}$/.test(productId)) throw new Error("Produit invalide.");
  const prefix = `builds/${makerId}/${productId}/`;
  if (!key.startsWith(prefix) || key.includes("..") || !key.endsWith(".apk")) {
    throw new Error("Clé de build invalide.");
  }
}

/** Ouvre une session multipart (clé confinée, 15 min pour la 1re part). */
export async function createMultipartUpload(input: {
  makerId: string;
  productId: string;
  contentLength: number;
}): Promise<{ uploadId: string; key: string }> {
  if (!Number.isFinite(input.contentLength) || input.contentLength <= 0) {
    throw new Error("Taille de fichier illisible.");
  }
  if (input.contentLength > MAX_BUILD_BYTES) {
    throw new Error("APK trop lourd (300 Mo maximum).");
  }
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `builds/${input.makerId}/${input.productId}/${Date.now()}-${rand}.apk`;
  assertBuildKey(input.makerId, input.productId, key);
  const res = await r2().send(
    new CreateMultipartUploadCommand({
      Bucket: PRODUCT_BUILDS_BUCKET,
      Key: key,
      ContentType: APK_CONTENT_TYPE,
    }),
  );
  if (!res.UploadId) throw new Error("Session d'envoi impossible pour le moment.");
  return { uploadId: res.UploadId, key };
}

/** URL présignée pour UNE part (PUT direct, retryable indépendamment). */
export async function presignMultipartPart(input: {
  makerId: string;
  productId: string;
  key: string;
  uploadId: string;
  partNumber: number;
}): Promise<{ url: string }> {
  assertBuildKey(input.makerId, input.productId, input.key);
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
    throw new Error("Numéro de part invalide.");
  }
  if (!input.uploadId) throw new Error("Session d'envoi invalide.");
  const url = await getSignedUrl(
    r2(),
    new UploadPartCommand({
      Bucket: PRODUCT_BUILDS_BUCKET,
      Key: input.key,
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
    }),
    { expiresIn: 900 },
  );
  return { url };
}

/** Parts déjà reçues (reprise : ne renvoyer que le manquant). */
export async function listMultipartParts(input: {
  makerId: string;
  productId: string;
  key: string;
  uploadId: string;
}): Promise<MultipartPart[]> {
  assertBuildKey(input.makerId, input.productId, input.key);
  if (!input.uploadId) throw new Error("Session d'envoi invalide.");
  const out: MultipartPart[] = [];
  let marker: string | undefined;
  for (;;) {
    const res = await r2().send(
      new ListPartsCommand({
        Bucket: PRODUCT_BUILDS_BUCKET,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumberMarker: marker,
      }),
    );
    for (const p of res.Parts ?? []) {
      if (typeof p.PartNumber === "number" && typeof p.ETag === "string") {
        out.push({ n: p.PartNumber, etag: p.ETag, size: typeof p.Size === "number" ? p.Size : 0 });
      }
    }
    if (!res.IsTruncated) break;
    marker =
      typeof res.NextPartNumberMarker === "number" ? String(res.NextPartNumberMarker) : undefined;
    if (marker === undefined) break;
    if (out.length > 10000) break;
  }
  return out;
}

/** Compose l'objet final (le record + re-vérif existants prennent le relais). */
export async function completeMultipartUpload(input: {
  makerId: string;
  productId: string;
  key: string;
  uploadId: string;
  parts: MultipartPart[];
}): Promise<void> {
  assertBuildKey(input.makerId, input.productId, input.key);
  if (!input.uploadId) throw new Error("Session d'envoi invalide.");
  if (input.parts.length === 0) throw new Error("Aucune part reçue.");
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: PRODUCT_BUILDS_BUCKET,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: [...input.parts]
          .sort((a, b) => a.n - b.n)
          .map((p) => ({ ETag: p.etag, PartNumber: p.n })),
      },
    }),
  );
}

/** Abandon explicite (plus de facturation fantôme). */
export async function abortMultipartUpload(input: {
  makerId: string;
  productId: string;
  key: string;
  uploadId: string;
}): Promise<void> {
  assertBuildKey(input.makerId, input.productId, input.key);
  if (!input.uploadId) return;
  await r2()
    .send(
      new AbortMultipartUploadCommand({
        Bucket: PRODUCT_BUILDS_BUCKET,
        Key: input.key,
        UploadId: input.uploadId,
      }),
    )
    .catch(() => {});
}

/**
 * Abandon des sessions multipart de plus de 24 h (D6) : sans ça, les
 * parts d'uploads interrompus restent facturées. Appelé par run-jobs.
 */
export async function abortStaleMultipartUploads(
  olderThanHours = 24,
): Promise<{ aborted: number }> {
  let aborted = 0;
  const cutoff = Date.now() - olderThanHours * 3_600_000;
  let keyMarker: string | undefined;
  let uploadMarker: string | undefined;
  for (;;) {
    const res = await r2().send(
      new ListMultipartUploadsCommand({
        Bucket: PRODUCT_BUILDS_BUCKET,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadMarker,
      }),
    );
    for (const u of res.Uploads ?? []) {
      if (!u.Key || !u.UploadId || !u.Initiated) continue;
      if (u.Initiated.getTime() > cutoff) continue;
      if (!u.Key.startsWith("builds/") || !u.Key.endsWith(".apk")) continue;
      await r2()
        .send(
          new AbortMultipartUploadCommand({
            Bucket: PRODUCT_BUILDS_BUCKET,
            Key: u.Key,
            UploadId: u.UploadId,
          }),
        )
        .catch(() => {});
      aborted++;
      if (aborted >= 500) return { aborted };
    }
    if (!res.IsTruncated) break;
    keyMarker = res.NextKeyMarker;
    uploadMarker = res.NextUploadIdMarker;
    if (keyMarker === undefined) break;
  }
  return { aborted };
}

/**
 * Lecteur par tranches HTTP Range sur un objet R2 (D3) : la re-vérif
 * serveur (EOCD + signing block + petits META-INF) ne lit que des Ko,
 * jamais les 300 Mo. Compatible `SliceReader` (lib/apk).
 */
export function r2SliceReader(bucket: string, key: string, size: number): SliceReader {
  return {
    size,
    slice: async (start: number, end: number) => {
      const s = Math.max(0, Math.floor(start));
      const e = Math.min(Math.ceil(end), size);
      if (e <= s) return new Uint8Array(0);
      const res = await r2().send(
        new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${s}-${e - 1}` }),
      );
      const body = res.Body;
      if (!body) throw new Error("Tranche R2 vide.");
      return new Uint8Array(await body.transformToByteArray());
    },
  };
}
