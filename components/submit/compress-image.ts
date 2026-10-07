"use client";

/**
 * Compression navigateur avant envoi (le draft arrête de ramer) :
 * canvas → WebP q0.82, redimensionné seulement si > 1600 px sur le grand
 * côté (jamais sous les minimums serveur 256/400 — le serveur re-vérifie
 * tout de toute façon). Échec (navigateur ancien, image exotique) =
 * fichier original (le serveur tranche, jamais de blocage client).
 * EXIF orientation respectée (createImageBitmap `from-image`, repli
 * <img> qui la respecte aussi sur les navigateurs modernes).
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

async function decode(
  file: File,
): Promise<{ bmp: ImageBitmap | HTMLImageElement; w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bmp, w: bmp.width, h: bmp.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("illisible"));
        el.src = url;
      });
      return { bmp: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file;
  try {
    const { bmp, w, h } = await decode(file);
    const scale = Math.max(w, h) > MAX_SIDE ? MAX_SIDE / Math.max(w, h) : 1;
    // Déjà petit : on ne touche à rien (zéro perte).
    if (scale === 1 && file.type === "image/webp" && file.size <= 1024 * 1024) return file;
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, dw, dh);
    if ("close" in bmp && typeof bmp.close === "function") (bmp as ImageBitmap).close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size === 0) return file;
    // Compressé plus lourd que l'original (petit PNG net) : garder l'original.
    if (blob.size >= file.size) return file;
    const base = file.name.replace(/\.[a-z0-9]+$/i, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
