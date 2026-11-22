import "server-only";

import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import {
  inspectImageHeader,
  type SupportedRasterMime,
} from "@/server/catalog/image-header";
import { COVER_DATA_URL_MAX_BYTES } from "@/features/catalog/cover-rules";

/**
 * Importação segura de capa por link externo ("Colar link da imagem"):
 * - Proteção estrita contra SSRF:
 *   1. Somente protocolo `https:` (sem credenciais embutidas, sem portas locais/administrativas bloqueadas)
 *   2. Resolução explícita de DNS (`dns.lookup(..., { all: true })`) ANTES da conexão
 *   3. Bloqueio de todos os IPs privados, loopback, link-local, CGNAT, multicast e IPv4-mapped IPv6
 *   4. Redirecionamentos manuais (`redirect: "manual"`, máx. 3 saltos) revalidando protocolo + DNS a cada salto
 * - Validação de resposta:
 *   5. Timeout estrito de 5 segundos (`5000 ms`)
 *   6. `Content-Type: image/*` (exceto SVG)
 *   7. Leitura em stream limitada a `<= 5 MB` (`5 * 1024 * 1024` bytes)
 * - Re-encode e armazenamento:
 *   8. Re-encode com `sharp` para WebP limpo (`<= 512x768`, sem metadados EXIF)
 *   9. Salvamento no bucket do usuário (`covers/{userId}/{key}.webp`)
 */

export const COVER_URL_IMPORT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const COVER_URL_IMPORT_TIMEOUT_MS = 5000; // 5 s
const MAX_REDIRECT_HOPS = 3;
const MAX_INPUT_PIXELS = 4096 * 4096;

export type DnsLookupFn = (
  hostname: string
) => Promise<ReadonlyArray<{ address: string; family?: number }>>;

export type CoverUrlImportErrorCode =
  | "invalid_url"
  | "non_https"
  | "ssrf_blocked"
  | "dns_failed"
  | "timeout"
  | "http_error"
  | "invalid_content_type"
  | "too_large"
  | "invalid_image";

export type CoverUrlImportResult =
  | {
      ok: true;
      dataUrl: string;
      bucketPath: string;
      width: number;
      height: number;
      byteLength: number;
    }
  | {
      ok: false;
      code: CoverUrlImportErrorCode;
      error: string;
    };

/* ============================================================================
   BUCKET VIRTUAL DO USUÁRIO (`covers/{userId}/{filename}.webp`)
   ============================================================================ */

interface UserCoverBucketObject {
  userId: string;
  bucketPath: string;
  mimeType: SupportedRasterMime;
  bytes: Buffer;
  width: number;
  height: number;
  createdAt: string;
}

declare global {
  var __readingFlowUserCoverBucket:
    Map<string, UserCoverBucketObject> | undefined;
}

function getUserCoverBucketStore(): Map<string, UserCoverBucketObject> {
  if (!globalThis.__readingFlowUserCoverBucket) {
    globalThis.__readingFlowUserCoverBucket = new Map<
      string,
      UserCoverBucketObject
    >();
  }
  return globalThis.__readingFlowUserCoverBucket;
}

export function saveToUserCoverBucket(params: {
  userId: string;
  editionId?: string | null;
  webpBuffer: Buffer;
  mimeType?: SupportedRasterMime;
  extension?: "webp" | "png" | "jpg" | "gif";
  width: number;
  height: number;
}): { bucketPath: string; dataUrl: string } {
  const safeUserId = params.userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const digest = createHash("sha256")
    .update(params.webpBuffer)
    .digest("hex")
    .slice(0, 16);
  const safeEditionPart = params.editionId
    ? params.editionId.replace(/[^a-zA-Z0-9_-]/g, "_")
    : "cover";
  const mimeType: SupportedRasterMime = params.mimeType ?? "image/webp";
  const extension = params.extension ?? "webp";
  const bucketPath = `covers/${safeUserId}/${safeEditionPart}-${digest}.${extension}`;
  const dataUrl = `data:${mimeType};base64,${params.webpBuffer.toString("base64")}`;

  getUserCoverBucketStore().set(bucketPath, {
    userId: params.userId,
    bucketPath,
    mimeType,
    bytes: params.webpBuffer,
    width: params.width,
    height: params.height,
    createdAt: new Date().toISOString(),
  });

  return { bucketPath, dataUrl };
}

export function getFromUserCoverBucket(
  userId: string,
  bucketPath: string
): UserCoverBucketObject | null {
  const obj = getUserCoverBucketStore().get(bucketPath);
  if (!obj || obj.userId !== userId) return null;
  return obj;
}

/* ============================================================================
   CLASSIFICAÇÃO DE IP PRIVADO / LOOPBACK / LINK-LOCAL / RESERVADO (IPv4 & IPv6)
   ============================================================================ */

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums as [number, number, number, number];
}

function isPrivateOrReservedIpv4Octets(
  octets: [number, number, number, number]
): boolean {
  const [a, b, c] = octets;

  // 0.0.0.0/8 (rede local / não especificado)
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC 1918 privado)
  if (a === 10) return true;
  // 100.64.0.0/10 (RFC 6598 Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / AWS & Cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC 1918 privado: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF) e 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  // 192.168.0.0/16 (RFC 1918 privado)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast) e 240.0.0.0/4 (Reservado / Broadcast)
  if (a >= 224) return true;

  return false;
}

function expandIpv6ToGroups(rawIpv6: string): number[] | null {
  let addr = rawIpv6.toLowerCase().trim();
  const zoneIdx = addr.indexOf("%");
  if (zoneIdx !== -1) {
    addr = addr.slice(0, zoneIdx);
  }

  // Caso termine com IPv4 embutido (ex.: ::ffff:127.0.0.1)
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.slice(lastColon + 1).includes(".")) {
    const ipv4Part = addr.slice(lastColon + 1);
    const octets = parseIpv4Octets(ipv4Part);
    if (!octets) return null;
    const hi = ((octets[0] << 8) | octets[1]) >>> 0;
    const lo = ((octets[2] << 8) | octets[3]) >>> 0;
    addr = `${addr.slice(0, lastColon)}:${hi.toString(16)}:${lo.toString(16)}`;
  }

  const doubleColonParts = addr.split("::");
  if (doubleColonParts.length > 2) return null;

  const parseSegmentList = (segment: string): number[] | null => {
    if (!segment) return [];
    const items = segment.split(":");
    const out: number[] = [];
    for (const item of items) {
      if (!/^[0-9a-f]{1,4}$/.test(item)) return null;
      out.push(Number.parseInt(item, 16));
    }
    return out;
  };

  if (doubleColonParts.length === 1) {
    const groups = parseSegmentList(doubleColonParts[0]!);
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parseSegmentList(doubleColonParts[0]!);
  const right = parseSegmentList(doubleColonParts[1]!);
  if (!left || !right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;
  return [...left, ...Array<number>(missing).fill(0), ...right];
}

/**
 * Verifica se um endereço IPv4 ou IPv6 é privado, loopback, link-local, CGNAT,
 * multicast, reservado ou inválido.
 */
export function isPrivateOrReservedIp(rawIp: string): boolean {
  const cleaned = rawIp.trim().replace(/^\[|\]$/g, "");
  if (!cleaned) return true;

  const withoutZone = cleaned.split("%")[0] ?? cleaned;
  const ipVersion = net.isIP(withoutZone);

  if (ipVersion === 4) {
    const octets = parseIpv4Octets(withoutZone);
    return octets ? isPrivateOrReservedIpv4Octets(octets) : true;
  }

  if (ipVersion === 6) {
    const groups = expandIpv6ToGroups(withoutZone);
    if (!groups || groups.length !== 8) return true;

    const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];

    // :: (não especificado) ou ::1 (loopback)
    const first7Zero =
      g0 === 0 &&
      g1 === 0 &&
      g2 === 0 &&
      g3 === 0 &&
      g4 === 0 &&
      g5 === 0 &&
      g6 === 0;
    if (first7Zero && (g7 === 0 || g7 === 1)) return true;

    // IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96) ou NAT64 (64:ff9b::/96)
    const isIpv4Mapped =
      g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff;
    const isIpv4Compatible =
      g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0;
    const isNat64 =
      g0 === 0x0064 &&
      g1 === 0xff9b &&
      g2 === 0 &&
      g3 === 0 &&
      g4 === 0 &&
      g5 === 0;

    if (isIpv4Mapped || isIpv4Compatible || isNat64) {
      const embeddedOctets: [number, number, number, number] = [
        (g6 >> 8) & 0xff,
        g6 & 0xff,
        (g7 >> 8) & 0xff,
        g7 & 0xff,
      ];
      return isPrivateOrReservedIpv4Octets(embeddedOctets);
    }

    // 6to4 (2002::/16) — verifica IPv4 embutido nos grupos 1 e 2
    if (g0 === 0x2002) {
      const embeddedOctets: [number, number, number, number] = [
        (g1 >> 8) & 0xff,
        g1 & 0xff,
        (g2 >> 8) & 0xff,
        g2 & 0xff,
      ];
      if (isPrivateOrReservedIpv4Octets(embeddedOctets)) return true;
    }

    // Unique Local Address fc00::/7 (fc00:: - fdff::)
    if ((g0 & 0xfe00) === 0xfc00) return true;
    // Link-Local fe80::/10 (fe80:: - febf::)
    if ((g0 & 0xffc0) === 0xfe80) return true;
    // Site-Local depreciado fec0::/10
    if ((g0 & 0xffc0) === 0xfec0) return true;
    // Multicast ff00::/8
    if ((g0 & 0xff00) === 0xff00) return true;
    // Documentação 2001:db8::/32
    if (g0 === 0x2001 && g1 === 0x0db8) return true;
    // Discard 100::/64
    if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true;

    return false;
  }

  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
] as const;

const defaultDnsLookup: DnsLookupFn = async (hostname: string) =>
  dns.lookup(hostname, { all: true, verbatim: true });

export async function validateAndResolveSsrfSafeUrl(
  rawUrl: string,
  lookupImpl: DnsLookupFn = defaultDnsLookup
): Promise<
  | { ok: true; url: URL; resolvedIps: string[] }
  | { ok: false; code: CoverUrlImportErrorCode; error: string }
> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "invalid_url",
      error: "Informe o link HTTPS da imagem da capa.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      code: "invalid_url",
      error: "URL inválida. Cole um endereço completo começando com https://.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "non_https",
      error:
        "Por segurança, apenas links com protocolo https:// são permitidos.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      code: "ssrf_blocked",
      error: "Links com credenciais embutidas não são permitidos.",
    };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      ok: false,
      code: "ssrf_blocked",
      error: "Apenas a porta HTTPS padrão (443) é permitida.",
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return {
      ok: false,
      code: "ssrf_blocked",
      error: "Endereço local ou interno bloqueado pela proteção SSRF.",
    };
  }

  // Se o host já for um literal IP (IPv4 ou IPv6), valida diretamente
  if (net.isIP(host) !== 0) {
    if (isPrivateOrReservedIp(host)) {
      return {
        ok: false,
        code: "ssrf_blocked",
        error:
          "Endereços IP privados, loopback ou link-local são bloqueados pela proteção SSRF.",
      };
    }
    return { ok: true, url: parsed, resolvedIps: [host] };
  }

  // Resolve o DNS e verifica TODOS os IPs retornados
  let records: ReadonlyArray<{ address: string; family?: number }>;
  try {
    records = await lookupImpl(host);
  } catch {
    return {
      ok: false,
      code: "dns_failed",
      error: "Não foi possível resolver o domínio informado.",
    };
  }

  if (!records || records.length === 0) {
    return {
      ok: false,
      code: "dns_failed",
      error: "O domínio informado não possui endereço IP válido.",
    };
  }

  const resolvedIps: string[] = [];
  for (const rec of records) {
    const addr = rec.address?.trim();
    if (!addr || isPrivateOrReservedIp(addr)) {
      return {
        ok: false,
        code: "ssrf_blocked",
        error:
          "O domínio resolve para um IP privado, loopback ou link-local bloqueado pela proteção SSRF.",
      };
    }
    resolvedIps.push(addr);
  }

  return { ok: true, url: parsed, resolvedIps };
}

async function readResponseStreamWithLimit(
  response: Response,
  maxBytes: number
): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; code: "too_large" | "invalid_image"; error: string }
> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return {
        ok: false,
        code: "too_large",
        error: "A imagem excede o limite máximo de 5 MB.",
      };
    }
  }

  if (!response.body) {
    const arr = await response.arrayBuffer();
    if (arr.byteLength > maxBytes) {
      return {
        ok: false,
        code: "too_large",
        error: "A imagem excede o limite máximo de 5 MB.",
      };
    }
    return { ok: true, buffer: Buffer.from(arr) };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          return {
            ok: false,
            code: "too_large",
            error: "A imagem excede o limite máximo de 5 MB.",
          };
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return {
      ok: false,
      code: "invalid_image",
      error: "O link retornou um arquivo vazio.",
    };
  }

  return { ok: true, buffer: Buffer.concat(chunks, totalBytes) };
}

/**
 * Baixa a imagem de um link HTTPS externo com proteção SSRF completa, re-encoda com `sharp`
 * e salva no bucket do usuário.
 */
export async function importCoverFromExternalUrl(params: {
  url: string;
  userId: string;
  editionId?: string | null;
  fetchImpl?: typeof fetch;
  lookupImpl?: DnsLookupFn;
  timeoutMs?: number;
}): Promise<CoverUrlImportResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const lookupImpl = params.lookupImpl ?? defaultDnsLookup;
  const timeoutMs = params.timeoutMs ?? COVER_URL_IMPORT_TIMEOUT_MS;
  const signal = AbortSignal.timeout(timeoutMs);

  let currentUrlStr = params.url.trim();
  let finalResponse: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const validated = await validateAndResolveSsrfSafeUrl(
      currentUrlStr,
      lookupImpl
    );
    if (!validated.ok) {
      return validated;
    }

    let res: Response;
    try {
      res = await fetchImpl(validated.url.toString(), {
        method: "GET",
        signal,
        redirect: "manual",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          "User-Agent": "ReadingFlow-CoverImporter/1.0",
        },
      });
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          signal.aborted);
      return {
        ok: false,
        code: isAbort ? "timeout" : "http_error",
        error: isAbort
          ? "O download da imagem excedeu o tempo limite de 5 segundos."
          : "Não foi possível baixar a imagem deste link.",
      };
    }

    // Trata redirecionamentos 301/302/303/307/308 revalidando o destino contra SSRF
    if (
      res.status === 301 ||
      res.status === 302 ||
      res.status === 303 ||
      res.status === 307 ||
      res.status === 308
    ) {
      const location = res.headers.get("location")?.trim();
      if (!location) {
        return {
          ok: false,
          code: "http_error",
          error: "O link retornou um redirecionamento inválido.",
        };
      }
      if (hop === MAX_REDIRECT_HOPS) {
        return {
          ok: false,
          code: "http_error",
          error: "O link excedeu o número máximo de redirecionamentos.",
        };
      }
      try {
        currentUrlStr = new URL(location, validated.url).toString();
      } catch {
        return {
          ok: false,
          code: "invalid_url",
          error: "Endereço de redirecionamento inválido.",
        };
      }
      continue;
    }

    finalResponse = res;
    break;
  }

  if (!finalResponse) {
    return {
      ok: false,
      code: "http_error",
      error: "Não foi possível obter resposta do servidor de imagem.",
    };
  }

  if (!finalResponse.ok) {
    return {
      ok: false,
      code: "http_error",
      error: `O servidor da imagem respondeu com erro HTTP ${finalResponse.status}.`,
    };
  }

  const contentType = (finalResponse.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]!
    .trim();

  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    return {
      ok: false,
      code: "invalid_content_type",
      error:
        "O link informado não aponta para uma imagem válida (content-type deve ser image/*).",
    };
  }

  const streamResult = await readResponseStreamWithLimit(
    finalResponse,
    COVER_URL_IMPORT_MAX_BYTES
  );
  if (!streamResult.ok) {
    return streamResult;
  }

  // Valida magic bytes e dimensões reais em TypeScript puro (sem binário nativo)
  const header = inspectImageHeader(streamResult.buffer);
  if (!header || header.width <= 10 || header.height <= 10) {
    return {
      ok: false,
      code: "invalid_image",
      error:
        "A imagem baixada tem formato não suportado, dimensões inválidas ou é um placeholder 1×1.",
    };
  }

  if (header.width * header.height > MAX_INPUT_PIXELS) {
    return {
      ok: false,
      code: "too_large",
      error:
        "A imagem excede a resolução máxima permitida (4096×4096). Escolha outra imagem.",
    };
  }

  if (streamResult.buffer.byteLength > COVER_DATA_URL_MAX_BYTES) {
    return {
      ok: false,
      code: "too_large",
      error:
        "A imagem excede o tamanho máximo suportado. Envie pelo seletor de arquivo para otimizar no navegador.",
    };
  }

  const saved = saveToUserCoverBucket({
    userId: params.userId,
    editionId: params.editionId,
    webpBuffer: streamResult.buffer,
    mimeType: header.mimeType,
    extension: header.extension,
    width: header.width,
    height: header.height,
  });

  return {
    ok: true,
    dataUrl: saved.dataUrl,
    bucketPath: saved.bucketPath,
    width: header.width,
    height: header.height,
    byteLength: streamResult.buffer.byteLength,
  };
}
