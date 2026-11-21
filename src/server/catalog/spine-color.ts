import { pickDominantSpinePalette } from "@/features/catalog/spine-color-rules";
import { validateExternalCoverUrl } from "@/server/security/sanitize";

const MAX_IMAGE_BYTES = 3_000_000;

async function loadImageBuffer(
  coverUrl: string,
  signal?: AbortSignal
): Promise<Buffer | null> {
  if (coverUrl.startsWith("data:")) {
    const match = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      coverUrl
    );
    if (!match?.[1]) return null;
    const buf = Buffer.from(match[1], "base64");
    return buf.byteLength <= MAX_IMAGE_BYTES ? buf : null;
  }

  const safeUrl = validateExternalCoverUrl(coverUrl);
  if (!safeUrl) return null;

  const res = await fetch(safeUrl, { signal, redirect: "follow" });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) return null;
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength < 200 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    return null;
  }
  return Buffer.from(arrayBuffer);
}

/**
 * Calcula, no servidor, a cor principal (`spineColor`) e a segunda cor dominante
 * (`spineAccent`) da capa do livro no cadastro.
 */
export async function extractSpinePaletteFromCover(
  coverUrl: string,
  signal?: AbortSignal
): Promise<{ spineColor: string; spineAccent: string } | null> {
  try {
    const buffer = await loadImageBuffer(coverUrl, signal);
    if (!buffer) return null;

    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    const { data, info } = await sharp(buffer, { failOn: "none" })
      .resize(24, 24, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const palette = pickDominantSpinePalette(data, info.channels === 4 ? 4 : 3);
    if (!palette) return null;
    return {
      spineColor: palette.primary,
      spineAccent: palette.accent,
    };
  } catch {
    return null;
  }
}

/**
 * Compatibilidade: retorna apenas a cor principal da lombada.
 */
export async function extractSpineColorFromCover(
  coverUrl: string,
  signal?: AbortSignal
): Promise<string | null> {
  const palette = await extractSpinePaletteFromCover(coverUrl, signal);
  return palette?.spineColor ?? null;
}
