import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { captureError } from "@/lib/monitoring";

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
export async function deleteR2Object(bucket: R2Bucket, key: string): Promise<void> {
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
 */
export async function listR2Keys(bucket: R2Bucket, maxKeys = 5000): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }),
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
