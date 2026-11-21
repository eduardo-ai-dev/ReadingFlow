/**
 * Processamento da capa enviada pelo usuário, no navegador: confere o formato pelos
 * primeiros bytes, reduz (máx. 512×768) e recodifica em WebP (JPEG como alternativa),
 * devolvendo uma data URL pequena o bastante para a Server Action (limite de 1 MB).
 */
import {
  COVER_DATA_URL_MAX_BYTES,
  COVER_UPLOAD_MAX_HEIGHT,
  COVER_UPLOAD_MAX_SOURCE_BYTES,
  COVER_UPLOAD_MAX_WIDTH,
  detectImageMimeFromBytes,
  estimateBase64DecodedBytes,
  parseCoverDataUrl,
} from "@/features/catalog/cover-rules";

export type CoverUploadResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

const QUALITY_STEPS = [0.85, 0.72, 0.58, 0.45] as const;
const LINEN_FILL = "#F4EFE6";

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Tenta via elemento <img> caso createImageBitmap rejeite este arquivo
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function encodeCanvas(canvas: HTMLCanvasElement): string | null {
  for (const quality of QUALITY_STEPS) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    // Navegadores sem suporte a WebP devolvem PNG: usa JPEG como alternativa.
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    const parsed = parseCoverDataUrl(dataUrl);
    if (
      parsed &&
      estimateBase64DecodedBytes(parsed.base64) <= COVER_DATA_URL_MAX_BYTES
    ) {
      return dataUrl;
    }
  }
  return null;
}

export async function processCoverFile(file: File): Promise<CoverUploadResult> {
  if (file.size > COVER_UPLOAD_MAX_SOURCE_BYTES) {
    return {
      ok: false,
      error: `A imagem é muito grande (máximo de ${COVER_UPLOAD_MAX_SOURCE_BYTES / 1024 / 1024} MB).`,
    };
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!detectImageMimeFromBytes(header)) {
    return {
      ok: false,
      error: "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.",
    };
  }

  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    return { ok: false, error: "Não foi possível ler esta imagem." };
  }

  try {
    const scale = Math.min(
      1,
      COVER_UPLOAD_MAX_WIDTH / decoded.width,
      COVER_UPLOAD_MAX_HEIGHT / decoded.height
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return { ok: false, error: "Não foi possível processar esta imagem." };
    }
    // Fundo neutro para evitar áreas pretas se o formato final não tiver transparência.
    context.fillStyle = LINEN_FILL;
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    const dataUrl = encodeCanvas(canvas);
    if (!dataUrl) {
      return {
        ok: false,
        error: "A imagem continua grande demais após a compressão. Escolha outra.",
      };
    }
    return { ok: true, dataUrl };
  } finally {
    decoded.release();
  }
}
