import type { PendingApk } from "@/components/submit/submit-apk-section";

/**
 * Étapes nommées de la chaîne (D6) : l'UI dit où on en est vraiment
 * (presign lent, PUT mesuré, record opaque) au lieu d'un vague « envoi ».
 */
export type ApkUploadStep = "connexion" | "transfert" | "verification";

export const APK_UPLOAD_STEP_LABEL: Record<ApkUploadStep, string> = {
  connexion: "Connexion sécurisée…",
  transfert: "Transfert de l'APK…",
  verification: "Vérification serveur (signature)…",
};

/**
 * Erreur avec progression (D6) : des parts sont parties, la session est
 * gardée pour reprise — jamais de repli silencieux vers single-shot
 * (qui ré-uploaderait tout et orphelinerait la session).
 */
export class MultipartProgressError extends Error {}

/**
 * Multipart resumable (D6) : parts de 8 Mo via Blob.slice (zéro RAM sup),
 * chacune retryable et reprenable. Seuil 16 Mo : en dessous, single-shot
 * prouvé (instantané). Repli single-shot si l'init multipart échoue
 * (rien n'est encore parti — propre). Échec en cours → session gardée
 * (localStorage) pour reprise au retry, jamais de fallback silencieux
 * qui ré-uploaderait tout.
 */
export const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
export const MULTIPART_MIN_BYTES = 16 * 1024 * 1024;
const MULTIPART_RETRIES = 3;
/** Essais single-shot (<16 Mo) : PUT repris à zéro, attente réseau offerte. */
const SINGLESHOT_RETRIES = 3;

/** Info de nouvelle tentative remontée à l'UI (jamais silencieuse). */
export type ApkRetryInfo = {
  /** Tentative en cours (1-based) sur max. */
  attempt: number;
  max: number;
  /** Part concernée (multipart) — absente en single-shot. */
  part?: number;
  /** En attente du retour réseau (offline) : ne consomme pas d'essai. */
  waitingForNetwork: boolean;
  /** Octets déjà acquis (reprise affichable). */
  sentBytes: number;
  totalBytes: number;
};

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Attend le retour réseau (event online) — reprise auto, sans brûler d'essai. */
function waitForOnline(): Promise<void> {
  if (!isOffline()) return Promise.resolve();
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), 30_000);
    window.addEventListener(
      "online",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Un socket coupé ne fait pas toujours `onerror` : il peut se figer sans
 * aucun événement (le cas rapporté : % gelé, aucun retry émis). Le
 * watchdog aborte tout PUT sans progression pendant STALL_MS — l'abort
 * retombe dans la boucle retry qui annonce et reprend.
 */
const STALL_MS = 15_000;
const FETCH_TIMEOUT_MS = 30_000;

async function fetchJson<T>(
  url: string,
  body: unknown,
): Promise<{ res: Response | null; parsed: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }).catch(() => null);
    const parsed = (await res?.json().catch(() => null)) as T | null;
    return { res, parsed };
  } catch {
    return { res: null, parsed: null };
  } finally {
    clearTimeout(timer);
  }
}

/** PUT avec watchdog anti-freeze. Résout l'ETag (null si absent). */
function putBlob(
  url: string,
  blob: Blob,
  onTick: (sent: number) => void,
): Promise<{ etag: string | null }> {
  return new Promise<{ etag: string | null }>((resolve, reject) => {
    const put = new XMLHttpRequest();
    let lastTick = Date.now();
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(watch);
      fn();
    };
    // Watchdog : pas de progression pendant STALL_MS ⇒ abort. Sans ça,
    // un wifi coupé mid-PUT fige la promesse pour toujours (aucun event).
    const watch = setInterval(() => {
      if (Date.now() - lastTick > STALL_MS) {
        try {
          put.abort();
        } catch {
          // Abort qui échoue : on laisse onabort/onerror trancher.
        }
      }
    }, 5_000);
    put.open("PUT", url);
    put.setRequestHeader("Content-Type", "application/vnd.android.package-archive");
    put.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        lastTick = Date.now();
        onTick(e.loaded);
      }
    };
    put.onload = () => {
      done(() => {
        if (put.status < 200 || put.status >= 300) {
          reject(new Error("Envoi refusé par le stockage — réessayez."));
          return;
        }
        resolve({ etag: put.getResponseHeader("ETag") });
      });
    };
    put.onerror = () => {
      done(() => {
        if (isOffline()) {
          reject(new Error("Connexion perdue — l'envoi reprendra automatiquement."));
          return;
        }
        reject(new Error("Envoi impossible (réseau ou configuration) — réessayez."));
      });
    };
    put.onabort = () => {
      done(() => {
        if (isOffline()) {
          reject(new Error("Connexion perdue — l'envoi reprendra automatiquement."));
          return;
        }
        reject(new Error("Envoi interrompu (réseau trop lent ou coupé) — nouvelle tentative…"));
      });
    };
    put.send(blob);
  });
}

type MultipartSession = {
  uploadId: string;
  key: string;
  partSize: number;
  size: number;
};

function sessionKey(productId: string, file: File): string {
  return `apk-upload:${productId}:${file.size}:${file.lastModified}`;
}

function loadSession(productId: string, file: File): MultipartSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(productId, file));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<MultipartSession>;
    if (
      typeof s.uploadId !== "string" ||
      typeof s.key !== "string" ||
      typeof s.partSize !== "number" ||
      typeof s.size !== "number" ||
      s.size !== file.size ||
      s.partSize <= 0
    ) {
      return null;
    }
    return { uploadId: s.uploadId, key: s.key, partSize: s.partSize, size: s.size };
  } catch {
    return null;
  }
}

function saveSession(productId: string, file: File, s: MultipartSession): void {
  try {
    localStorage.setItem(sessionKey(productId, file), JSON.stringify(s));
  } catch {
    // Stockage indisponible (privé) : tant pis pour la reprise.
  }
}

function clearSession(productId: string, file: File): void {
  try {
    localStorage.removeItem(sessionKey(productId, file));
  } catch {
    // Best-effort.
  }
}

type PresignData = {
  ok?: boolean;
  data?: {
    url?: string;
    key?: string;
    uploadId?: string;
    parts?: Array<{ n: number; etag: string }>;
  };
  message?: string;
};

async function multipartCall(body: unknown): Promise<PresignData> {
  const { res, parsed } = await fetchJson<PresignData>("/api/uploads/presign", body);
  if (!res?.ok || !parsed?.ok) {
    // Offline-first : en dev local, couper le wifi ne coupe pas localhost —
    // l'API répond (401 session invérifiable côté serveur, ex. "Connexion
    // requise.") alors que c'est bien une coupure réseau. Si le navigateur
    // est offline, c'est TOUJOURS une coupure, quel que soit le corps reçu.
    if (isOffline()) {
      throw new Error("Connexion perdue — l'envoi reprendra automatiquement.");
    }
    throw new Error(
      typeof parsed?.message === "string" && parsed.message !== ""
        ? parsed.message
        : "Stockage indisponible pour le moment.",
    );
  }
  return parsed;
}

function putPart(url: string, blob: Blob, onTick: (sent: number) => void): Promise<string> {
  return putBlob(url, blob, onTick).then(({ etag }) => {
    if (!etag) {
      throw new Error("Réponse de stockage incomplète — réessayez.");
    }
    return etag;
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function uploadApkMultipart(input: {
  productId: string;
  file: File;
  onProgress?: (loaded: number, total: number) => void;
  onStep?: (step: ApkUploadStep) => void;
  onRetry?: (info: ApkRetryInfo) => void;
}): Promise<{ key: string }> {
  const { productId, file } = input;
  const total = file.size;
  const partSize = MULTIPART_PART_BYTES;
  const partCount = Math.ceil(total / partSize);
  input.onStep?.("connexion");

  // Session existante (reprise) ou création.
  let session = loadSession(productId, file);
  if (!session) {
    const created = await multipartCall({
      multipart: { action: "create", productId, contentLength: total },
    });
    const uploadId = created.data?.uploadId;
    const key = created.data?.key;
    if (!uploadId || !key) throw new Error("Session d'envoi impossible pour le moment.");
    session = { uploadId, key, partSize, size: total };
    saveSession(productId, file, session);
  }
  const { uploadId, key } = session;

  // Parts déjà reçues (on ne renvoie que le manquant).
  const listed = await multipartCall({
    multipart: { action: "parts", productId, key, uploadId },
  });
  const done = new Map<number, string>();
  for (const p of listed.data?.parts ?? []) {
    if (typeof p?.n === "number" && typeof p?.etag === "string") done.set(p.n, p.etag);
  }

  input.onStep?.("transfert");
  let sentBase = 0;
  try {
    for (let n = 1; n <= partCount; n++) {
      const start = (n - 1) * partSize;
      const end = Math.min(n * partSize, total);
      if (done.has(n)) {
        sentBase = end;
        input.onProgress?.(sentBase, total);
        continue;
      }
      const chunk = file.slice(start, end);
      const etag = await (async (): Promise<string> => {
        let attempt = 0;
        for (;;) {
          try {
            const part = await multipartCall({
              multipart: { action: "part", productId, key, uploadId, partNumber: n },
            });
            const url = part.data?.url;
            if (!url) throw new Error("URL de part indisponible — réessayez.");
            return await putPart(url, chunk, (sent) => input.onProgress?.(sentBase + sent, total));
          } catch (e) {
            // Offline : on attend le réseau (annoncé à l'UI) SANS brûler
            // d'essai — couper ici abandonnerait des parts déjà payées.
            if (isOffline()) {
              input.onRetry?.({
                attempt: attempt + 1,
                max: MULTIPART_RETRIES,
                part: n,
                waitingForNetwork: true,
                sentBytes: sentBase,
                totalBytes: total,
              });
              await waitForOnline();
              continue;
            }
            attempt++;
            if (attempt >= MULTIPART_RETRIES) throw e;
            input.onRetry?.({
              attempt,
              max: MULTIPART_RETRIES,
              part: n,
              waitingForNetwork: false,
              sentBytes: sentBase,
              totalBytes: total,
            });
            await sleep(1000 * attempt);
          }
        }
      })();
      done.set(n, etag);
      sentBase = end;
      input.onProgress?.(sentBase, total);
    }

    // Composition serveur (le record + re-vérif existants prennent le relais).
    const completed = [...done.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([partNumber, partEtag]) => ({ n: partNumber, etag: partEtag }));
    await multipartCall({
      multipart: { action: "complete", productId, key, uploadId, parts: completed },
    });
  } catch (e) {
    // Progression existante (reprise comprise) → on garde la session et on
    // refuse le repli single-shot (qui ré-uploaderait tout + orphelins).
    if (done.size > 0) {
      throw new MultipartProgressError(e instanceof Error ? e.message : "Envoi interrompu.");
    }
    throw e;
  }
  clearSession(productId, file);
  return { key };
}

/**
 * Chaîne d'enregistrement d'un build APK (D2/D4, web) : presign →
 * PUT R2 direct (jamais via Vercel) → record `pending` (revue bloquante).
 * Throw = message FR affichable. Le CALLER gère l'échec (fiche sauvée +
 * rattrapage dashboard — jamais bloquant).
 */
export async function uploadApkBuild(input: {
  productId: string;
  pending: PendingApk;
  whatsnew: string | null;
  onProgress?: (loaded: number, total: number) => void;
  onStep?: (step: ApkUploadStep) => void;
  onRetry?: (info: ApkRetryInfo) => void;
}): Promise<{ buildId: string }> {
  // Gros fichiers (D6) : multipart resumable, avec repli single-shot si
  // l'init échoue (rien n'est encore parti — propre). Échec en cours
  // (parts parties) → on laisse l'erreur (session gardée pour reprise
  // au retry, jamais de ré-upload silencieux). Petits fichiers :
  // single-shot prouvé, instantané.
  let key: string;
  if (input.pending.file.size >= MULTIPART_MIN_BYTES) {
    try {
      ({ key } = await uploadApkMultipart({
        productId: input.productId,
        file: input.pending.file,
        onProgress: input.onProgress,
        onStep: input.onStep,
        onRetry: input.onRetry,
      }));
    } catch (e) {
      if (e instanceof MultipartProgressError) throw e;
      key = (await uploadSingleShot(input)).key;
    }
  } else {
    key = (await uploadSingleShot(input)).key;
  }
  input.onStep?.("verification");

  /**
   * Single-shot prouvé (D1-D5) : presign → PUT direct. Utilisé pour les
   * petits fichiers et en repli si l'init multipart échoue.
   * Retry 3 essais + attente réseau SANS brûler d'essai (même contrat
   * que le multipart : couper le wifi met en pause, pas en échec).
   */
  async function uploadSingleShot(input: {
    productId: string;
    pending: PendingApk;
    onProgress?: (loaded: number, total: number) => void;
    onStep?: (step: ApkUploadStep) => void;
    onRetry?: (info: ApkRetryInfo) => void;
  }): Promise<{ key: string }> {
    const total = input.pending.file.size;
    let attempt = 0;
    for (;;) {
      try {
        input.onStep?.("connexion");
        const { res: preRes, parsed: preBody } = await fetchJson<{
          ok?: boolean;
          data?: { url?: string; key?: string };
          message?: string;
        }>("/api/uploads/presign", { productId: input.productId, contentLength: total });
        const url = preBody?.data?.url;
        const key = preBody?.data?.key;
        // Offline-first (voir multipartCall) : un 401 "Connexion requise."
        // peut être la coupure elle-même (serveur injoignable derrière).
        if (isOffline()) {
          throw new Error("Connexion perdue — en pause, reprise automatique.");
        }
        if (!preRes?.ok || !preBody?.ok || !url || !key) {
          throw new Error(
            typeof preBody?.message === "string" && preBody.message !== ""
              ? preBody.message
              : "Stockage indisponible pour le moment.",
          );
        }
        await putBlob(url, input.pending.file, (sent) => {
          input.onStep?.("transfert");
          input.onProgress?.(sent, total);
        });
        return { key };
      } catch (e) {
        // Offline : on attend le réseau (annoncé à l'UI) SANS brûler
        // d'essai — le PUT reprend à zéro sur la même URL présignée
        // (valide 15 min, PUT idempotent sur clé R2).
        if (isOffline()) {
          input.onRetry?.({
            attempt: attempt + 1,
            max: SINGLESHOT_RETRIES,
            waitingForNetwork: true,
            sentBytes: 0,
            totalBytes: total,
          });
          await waitForOnline();
          continue;
        }
        attempt++;
        if (attempt >= SINGLESHOT_RETRIES) throw e;
        input.onRetry?.({
          attempt,
          max: SINGLESHOT_RETRIES,
          waitingForNetwork: false,
          sentBytes: 0,
          totalBytes: total,
        });
        await sleep(1000 * attempt);
      }
    }
  }

  input.onStep?.("verification");
  const recordBody = {
    r2Key: key,
    sha256: input.pending.sha256,
    sizeBytes: input.pending.file.size,
    versionCode: input.pending.manifest.versionCode,
    versionName: input.pending.manifest.versionName,
    whatsnew: input.whatsnew,
    package: input.pending.manifest.package,
    minSdk: input.pending.manifest.minSdk,
    targetSdk: input.pending.manifest.targetSdk,
    permissions: input.pending.manifest.permissions,
    certSha256: input.pending.certs[0]?.sha256 ?? null,
    certSha1: input.pending.certs[0]?.sha1 ?? null,
    sigScheme: input.pending.certs[0]?.scheme ?? null,
    certSubjectCn: input.pending.certs[0]?.subjectCn ?? null,
    certSubjectO: input.pending.certs[0]?.subjectO ?? null,
    certKeyAlg: input.pending.certs[0]?.keyAlg ?? null,
    certKeyBits: input.pending.certs[0]?.keyBits ?? null,
    certSigAlg: input.pending.certs[0]?.sigAlg ?? null,
  };
  // Record : 1 essai + 1 reprise après retour réseau (offline-first :
  // un 401 ici peut être la coupure elle-même, pas une vraie déconnexion).
  // "Déjà enregistré" après coupure = le premier appel était bien arrivé :
  // succès récupéré (le serveur déduplique, jamais de doublon).
  let recRes: Response | null = null;
  type RecordBody = { ok?: boolean; data?: { buildId?: string }; message?: string };
  let recBody: RecordBody | null = null;
  for (let recAttempt = 0; recAttempt < 2; recAttempt++) {
    if (recAttempt > 0) await waitForOnline();
    ({ res: recRes, parsed: recBody } = await fetchJson<RecordBody>(
      `/api/products/${input.productId}/builds`,
      recordBody,
    ));
    if (recRes?.ok && recBody?.ok && recBody.data?.buildId) {
      return { buildId: recBody.data.buildId };
    }
    const alreadyRecorded =
      typeof recBody?.message === "string" && recBody.message.includes("déjà enregistré");
    if (alreadyRecorded) {
      return { buildId: "recovered" };
    }
    if (!isOffline()) break;
    input.onRetry?.({
      attempt: recAttempt + 1,
      max: 2,
      waitingForNetwork: true,
      sentBytes: input.pending.file.size,
      totalBytes: input.pending.file.size,
    });
  }
  if (isOffline()) {
    throw new Error("Connexion perdue — l'enregistrement reprendra : relancez l'envoi.");
  }
  throw new Error(
    typeof recBody?.message === "string" && recBody.message !== ""
      ? recBody.message
      : "Enregistrement impossible pour le moment.",
  );
}
