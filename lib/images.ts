import sharp, { type Sharp } from "sharp";

/**
 * Pipeline image partagée (avatars users + médias produits) — UNE seule
 * implémentation des garde-fous : magic-bytes (PNG/JPG/WebP seuls —
 * SVG/GIF/exécutables refusés : XSS, animation), bombe de décompression
 * (cap input), dimensions minimales, sortie WebP calibrée.
 * Le stockage reste du ressort de l'appelant (Supabase Storage pour les
 * avatars, R2 pour les produits) : ici, que des bytes validés.
 *
 * Fits :
 * - "cover-square" (défaut, avatars) : recadrage carré — OK pour un visage.
 * - "contain-square" (logos) : PAS de recadrage — padding transparent
 *   (un wordmark large ne doit jamais être coupé).
 * - "inside" (captures) : ratio source préservé, côté long plafonné —
 *   jamais de perte de contenu, jamais de mix (l'uniformité par fiche
 *   est imposée en amont, pas ici).
 */

export type ImageKind = "png" | "jpeg" | "webp";

/** Orientation déclarée d'une galerie (pilotée par le type de produit). */
export type ShotOrientation = "portrait" | "landscape";

export type ImageFit = "cover-square" | "contain-square" | "inside";

export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (
    buffer.length > 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "jpeg";
  if (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

export class ImageRejectedError extends Error {}

/** Dimensions réelles (EXIF appliqué). Jette ImageRejectedError si illisible. */
export async function measureImage(buffer: Buffer): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(buffer).rotate().metadata();
    if (!meta.width || !meta.height) throw new ImageRejectedError("Image illisible ou corrompue.");
    return { width: meta.width, height: meta.height };
  } catch (e) {
    if (e instanceof ImageRejectedError) throw e;
    throw new ImageRejectedError("Image illisible ou corrompue.");
  }
}

/**
 * Bucket d'orientation : ratio > 1.05 = paysage, < 0.95 = portrait.
 * Le carré (±5 %) N'EST PAS un bucket : il hérite de la déclaration
 * (jamais rejeté pour son ratio — un 1:1 rend propre dans les deux).
 */
export function classifyShotOrientation(
  width: number,
  height: number,
  declared: ShotOrientation,
): ShotOrientation {
  const ratio = width / height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return declared;
}

/** Ratio hors 1:3…3:1 (bannière, strip) : refusé quel que soit le preset. */
function assertSaneAspect(width: number, height: number): void {
  const ratio = width / height;
  if (ratio > 3 || ratio < 1 / 3) {
    throw new ImageRejectedError("Format trop allongé — recadrez votre visuel.");
  }
}

/**
 * Valide + transforme : EXIF auto (photos téléphone), sortie WebP.
 * Jette ImageRejectedError (message FR affichable) — jamais d'erreur
 * sharp brute au client.
 */
export async function processImage(
  buffer: Buffer,
  opts: {
    maxInputBytes: number;
    minPx: number;
    outPx: number;
    outQuality: number;
    maxOutBytes: number;
    fit?: ImageFit;
    /** Plafond du côté long (preset "inside") — défaut outPx. */
    maxLongEdge?: number;
  },
): Promise<Buffer> {
  if (buffer.byteLength > opts.maxInputBytes) {
    throw new ImageRejectedError(
      `Fichier trop lourd (${Math.round(opts.maxInputBytes / 1024 / 1024)} Mo max avant compression).`,
    );
  }
  const kind = detectImageKind(buffer);
  if (!kind) {
    throw new ImageRejectedError(
      "Format non supporté — PNG, JPG ou WebP uniquement (SVG interdit).",
    );
  }
  const { width, height } = await measureImage(buffer);
  if (Math.min(width, height) < opts.minPx) {
    throw new ImageRejectedError(`Image trop petite — ${opts.minPx} px minimum.`);
  }
  const fail = (message: string): never => {
    throw new ImageRejectedError(message);
  };
  const fit = opts.fit ?? "cover-square";
  let pipeline: Sharp;
  try {
    pipeline = sharp(buffer).rotate();
    if (fit === "inside") {
      assertSaneAspect(width, height);
      const edge = opts.maxLongEdge ?? opts.outPx;
      pipeline = pipeline.resize({
        width: edge,
        height: edge,
        fit: "inside",
        withoutEnlargement: true,
      });
    } else if (fit === "contain-square") {
      assertSaneAspect(width, height);
      pipeline = pipeline.resize(opts.outPx, opts.outPx, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    } else {
      pipeline = pipeline.resize(opts.outPx, opts.outPx, { fit: "cover" });
    }
  } catch (e) {
    if (e instanceof ImageRejectedError) throw e;
    fail("Image illisible ou corrompue.");
  }
  let out: Buffer;
  try {
    out = await pipeline!.webp({ quality: opts.outQuality }).toBuffer();
  } catch {
    fail("Compression impossible — essayez un visuel plus simple.");
  }
  if (out!.length > opts.maxOutBytes) {
    fail("Image incompressible — essayez un visuel plus simple.");
  }
  return out!;
}

/** Extensions sûres déduites du contenu (jamais de l'extension d'origine). */
export function extForKind(kind: ImageKind): "png" | "jpg" | "webp" {
  return kind === "jpeg" ? "jpg" : kind;
}
