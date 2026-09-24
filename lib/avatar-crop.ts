/**
 * Crop avatar côté client — carré 1:1, sortie bornée 512 px (miroir de
 * AVATAR_OUT_PX serveur, qui re-valide et recompresse : défense en
 * profondeur, jamais de confiance au client). Testable hors DOM pour la
 * partie calcul (verify script : ratios + bornes).
 */

export const AVATAR_CROP_OUT_PX = 512;

export type CropPixels = { x: number; y: number; width: number; height: number };

/** Dimensions de sortie : min(crop, 512), ratio conservé (carré). */
export function cropOutputSize(crop: CropPixels): {
  width: number;
  height: number;
} {
  const side = Math.max(
    1,
    Math.min(Math.round(Math.min(crop.width, crop.height)), AVATAR_CROP_OUT_PX),
  );
  return { width: side, height: side };
}

/**
 * Rend le crop en File WebP (qualité 0.92 — le serveur recompresse à q82,
 * double compression assumée et mesurée acceptable à cette taille).
 * Rejette si le canvas est vide (image corrompue).
 */
export async function cropImageToFile(imageSrc: string, crop: CropPixels): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = imageSrc;
  });
  const { width, height } = cropOutputSize(crop);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.92),
  );
  if (!blob || blob.size === 0) throw new Error("Crop vide.");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}
