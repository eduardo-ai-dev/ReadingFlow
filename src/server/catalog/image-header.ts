/**
 * Parser binário em TypeScript puro (100% compatível com Cloudflare Workers / workerd)
 * para validação de magic bytes e extração de dimensões reais de imagens
 * PNG, JPEG, WebP (VP8 / VP8L / VP8X) e GIF sem dependências nativas (`sharp`).
 */

export type SupportedRasterMime =
  "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface ParsedImageHeader {
  mimeType: SupportedRasterMime;
  extension: "png" | "jpg" | "webp" | "gif";
  width: number;
  height: number;
}

function parsePng(bytes: Uint8Array): ParsedImageHeader | null {
  if (bytes.byteLength < 24) return null;
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return null;
  }
  // Chunk IHDR começa no byte 12 ("IHDR") e dimensões nos bytes 16..23
  if (
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) return null;
  return { mimeType: "image/png", extension: "png", width, height };
}

function parseGif(bytes: Uint8Array): ParsedImageHeader | null {
  if (bytes.byteLength < 10) return null;
  if (
    bytes[0] !== 0x47 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x38 ||
    (bytes[4] !== 0x37 && bytes[4] !== 0x39) ||
    bytes[5] !== 0x61
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  if (width === 0 || height === 0) return null;
  return { mimeType: "image/gif", extension: "gif", width, height };
}

function parseWebp(bytes: Uint8Array): ParsedImageHeader | null {
  if (bytes.byteLength < 30) return null;
  // "RIFF" ... "WEBP"
  if (
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return null;
  }

  const chunk = String.fromCharCode(
    bytes[12] ?? 0,
    bytes[13] ?? 0,
    bytes[14] ?? 0,
    bytes[15] ?? 0
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === "VP8X") {
    const width =
      1 +
      ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16));
    const height =
      1 +
      ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16));
    if (width <= 0 || height <= 0) return null;
    return { mimeType: "image/webp", extension: "webp", width, height };
  }

  if (chunk === "VP8L") {
    // Byte 20 deve ser assinatura 0x2f
    if (bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    if (width <= 0 || height <= 0) return null;
    return { mimeType: "image/webp", extension: "webp", width, height };
  }

  if (chunk === "VP8 ") {
    // Assinatura de keyframe VP8 (9D 01 2A) nos bytes 23..25
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    if (width <= 0 || height <= 0) return null;
    return { mimeType: "image/webp", extension: "webp", width, height };
  }

  return null;
}

function parseJpeg(bytes: Uint8Array): ParsedImageHeader | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.byteLength && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.byteLength) break;

    const marker = bytes[offset] ?? 0;
    offset += 1;

    // Marcadores sem comprimento (SOI, EOI, RST0..RST7, TEM)
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 2 > bytes.byteLength) break;
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      break;
    }

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 7 <= bytes.byteLength) {
      const height = view.getUint16(offset + 3, false);
      const width = view.getUint16(offset + 5, false);
      if (width > 0 && height > 0) {
        return { mimeType: "image/jpeg", extension: "jpg", width, height };
      }
      return null;
    }

    offset += segmentLength;
  }

  return null;
}

/**
 * Inspeciona magic bytes e cabeçalho de uma imagem raster (PNG, JPEG, WebP ou GIF).
 * Retorna `null` para payloads corrompidos, SVG, HTML ou formatos não suportados.
 */
export function inspectImageHeader(
  input: Uint8Array | Buffer
): ParsedImageHeader | null {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new Uint8Array(input as ArrayBufferLike);
  if (bytes.byteLength < 10) return null;

  return (
    parsePng(bytes) ?? parseWebp(bytes) ?? parseJpeg(bytes) ?? parseGif(bytes)
  );
}
