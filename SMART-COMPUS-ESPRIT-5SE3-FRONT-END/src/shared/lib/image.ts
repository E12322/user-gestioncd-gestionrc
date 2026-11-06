export type ImageErrorCode = "type" | "size" | "read";

export class ImageError extends Error {
  constructor(public readonly code: ImageErrorCode) {
    super(code);
    this.name = "ImageError";
  }
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Lit une image choisie par l'utilisateur, la recadre au centre en carré et la réduit (256 px par défaut).
 * Renvoie une data URL JPEG légère, prête à être envoyée au service de profil.
 */
export async function imageToAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new ImageError("type");
  if (file.size > MAX_IMAGE_BYTES) throw new ImageError("size");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageError("read"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("read");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
