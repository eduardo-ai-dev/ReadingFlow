"use client";

import { memo, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import type { ReadingStatus } from "@/lib/domain";
import { extractAuthorSurname } from "@/lib/cover-color";
import {
  getDevCoverDiagnostic,
  resolveBookCoverFallbackPalette,
  subscribeDevCoverDiagnostics,
} from "@/features/catalog/cover-search-rules";
import { isCoverDebugEnabled } from "@/features/catalog/cover-url";

const loggedDevCoverDiagnostics = new Set<string>();

/**
 * Reduz o peso de rede em miniaturas (<= 200px) baixando a variante `-M.jpg`
 * do Open Library em vez de `-L.jpg` para cartões compactos.
 */
function resolveThumbnailUrl(
  url: string,
  size: NonNullable<BookCoverProps["size"]>,
  fillContainer: boolean
): string {
  const isThumb =
    fillContainer || size === "xs" || size === "sm" || size === "md";
  if (!isThumb) return url;
  if (url.includes("covers.openlibrary.org/") && /-L\.jpg(\?.*)?$/i.test(url)) {
    return url.replace(/-L\.jpg(\?.*)?$/i, "-M.jpg$1");
  }
  return url;
}

export type BookSemanticStatus =
  | ReadingStatus
  | "lendo"
  | "em_andamento"
  | "concluido"
  | "lido"
  | "desejo"
  | "quero_ler"
  | "wishlist";

export interface BookCoverProps {
  title: string;
  author?: string;
  coverUrl?: string | null;
  spineColor?: string | null;
  spineAccent?: string | null;
  seed?: string;
  avoidNeighborHex?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Preenche 100% do contêiner pai (usado na face frontal do Book3D). */
  fillContainer?: boolean;
  /** Usar `true` apenas na capa principal grande da Mesa de Leitura. */
  priority?: boolean;
  /** Atributo `sizes` customizado para `next/image`. */
  sizes?: string;
  readingStatus?: BookSemanticStatus;
  isWishlist?: boolean;
  progressPercent?: number;
  currentPage?: number;
  totalPages?: number;
  /** Motivo de diagnóstico em ambiente de dev (nenhum resultado, filtro de qualidade, erro de API, cover_url vazia). */
  diagnosticReason?: string | null;
  /** Largura intrínseca da imagem estática (usa `width`/`height` explícitos no `next/image`, sem layout shift). */
  imageWidth?: number;
  /** Altura intrínseca da imagem estática (usa `width`/`height` explícitos no `next/image`, sem layout shift). */
  imageHeight?: number;
  /** Desativa a busca automática de diagnóstico em dev (ex.: prévia estática da landing page). */
  disableDevDiagnostics?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BookCoverProps["size"]>, string> = {
  xs: "w-11 aspect-[2/3]",
  sm: "w-16 aspect-[2/3]",
  md: "w-24 aspect-[2/3]",
  lg: "w-32 aspect-[2/3]",
  xl: "w-32 sm:w-44 aspect-[2/3]",
};

const DEFAULT_SIZES_BY_VARIANT: Record<
  NonNullable<BookCoverProps["size"]>,
  string
> = {
  xs: "48px",
  sm: "72px",
  md: "112px",
  lg: "160px",
  xl: "(max-width: 640px) 160px, 200px",
};

function getTitleScale(title: string): "short" | "medium" | "long" {
  const len = title.trim().length;
  if (len <= 14) return "short";
  if (len <= 32) return "medium";
  return "long";
}

function BookCoverBase({
  title,
  author,
  coverUrl,
  spineColor,
  spineAccent,
  seed,
  avoidNeighborHex,
  size = "md",
  fillContainer = false,
  priority = false,
  sizes,
  readingStatus,
  isWishlist = false,
  progressPercent,
  currentPage,
  totalPages,
  diagnosticReason,
  imageWidth,
  imageHeight,
  disableDevDiagnostics = false,
  className = "",
}: BookCoverProps) {
  const [failedState, setFailedState] = useState<{
    url: string;
    reason: "quality" | "error";
  } | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  const rawCoverUrl = coverUrl?.trim() || undefined;
  const normalizedCoverUrl = rawCoverUrl
    ? resolveThumbnailUrl(rawCoverUrl, size, fillContainer)
    : undefined;
  const imgFailed = Boolean(
    normalizedCoverUrl && failedState?.url === normalizedCoverUrl
  );
  const showImage = Boolean(normalizedCoverUrl && !imgFailed);
  const isImageLoaded = Boolean(showImage && loadedUrl === normalizedCoverUrl);
  const isDataUrl = Boolean(normalizedCoverUrl?.startsWith("data:"));

  const isCompact = !fillContainer && size === "xs";
  const coverDebugEnabled = isCoverDebugEnabled();
  const sharedDevDiag = useSyncExternalStore(
    subscribeDevCoverDiagnostics,
    () =>
      coverDebugEnabled
        ? (getDevCoverDiagnostic({ editionId: seed, title }) ?? null)
        : null,
    () => null
  );

  const devDiagReason: string | null =
    coverDebugEnabled && !disableDevDiagnostics && !showImage
      ? imgFailed && failedState?.reason === "quality"
        ? "filtro: dimensão (1×1 / inválida)"
        : imgFailed && failedState?.reason === "error"
          ? "img: 404 / falha de rede"
          : diagnosticReason?.trim() ||
            sharedDevDiag ||
            "sem busca ativa · clique em Buscar capas"
      : null;

  useEffect(() => {
    if (!coverDebugEnabled || !devDiagReason) return;
    const logKey = `${title}|${normalizedCoverUrl ?? ""}|${devDiagReason}`;
    if (loggedDevCoverDiagnostics.has(logKey)) return;
    loggedDevCoverDiagnostics.add(logKey);
    console.info(
      `[ReadingFlow/BookCover][dev] "${title}" sem capa real — motivo: ${devDiagReason}`
    );
  }, [coverDebugEnabled, title, normalizedCoverUrl, devDiagReason]);

  const palette = resolveBookCoverFallbackPalette({
    seed: seed || title,
    spineColor,
    spineAccent,
    avoidNeighborHex,
  });

  const authorSurname = extractAuthorSurname(author);
  const footerAuthor = author?.trim() || authorSurname;
  const resolvedSizes =
    sizes ??
    (fillContainer
      ? "(max-width: 480px) 120px, 156px"
      : DEFAULT_SIZES_BY_VARIANT[size]);

  const computedProgress =
    typeof currentPage === "number" &&
    typeof totalPages === "number" &&
    totalPages > 0
      ? Math.round((currentPage / totalPages) * 100)
      : (progressPercent ?? 0);
  const safeProgress = Math.max(0, Math.min(100, Math.round(computedProgress)));

  const normalizedStatus = String(readingStatus ?? "").toLowerCase();
  const isReading =
    normalizedStatus === "reading" ||
    normalizedStatus === "lendo" ||
    normalizedStatus === "em_andamento";
  const isFinished =
    normalizedStatus === "finished" ||
    normalizedStatus === "concluido" ||
    normalizedStatus === "lido";
  const effectiveWishlist =
    isWishlist ||
    normalizedStatus === "wishlist" ||
    normalizedStatus === "desejo" ||
    normalizedStatus === "quero_ler";
  const wishlistClasses = effectiveWishlist ? "rf-book-cover-wishlist" : "";

  const sizeClass = fillContainer ? "h-full w-full" : SIZE_CLASSES[size];
  const showProgressTrack = isReading || (!isFinished && safeProgress > 0);

  return (
    <div
      role={showImage ? undefined : "img"}
      lang="pt-BR"
      aria-label={
        showImage
          ? undefined
          : `Capa editorial de ${title}${authorSurname ? `, por ${authorSurname}` : ""}`
      }
      data-cover-state={
        showImage ? (isImageLoaded ? "loaded" : "loading") : "fallback"
      }
      data-dev-cover-diag={devDiagReason ?? undefined}
      title={devDiagReason ? `Dev · sem capa: ${devDiagReason}` : undefined}
      style={{
        containerType: "inline-size",
        backgroundColor: palette.backgroundHex,
      }}
      className={`rf-book-cover-2d relative shrink-0 overflow-hidden rounded-[3px] border border-[#141514]/22 shadow-[0_10px_20px_-8px_rgba(20,21,20,0.34),0_2px_6px_-1px_rgba(20,21,20,0.2)] select-none transition-[transform,filter,opacity] duration-300 ${sizeClass} ${wishlistClasses} ${className}`}
    >
      {/* 1. Fallback editorial gerado (sem monograma, cor viva derivada do id/spineColor, Playfair + sans, moldura fina).
             Permanece sob a imagem enquanto carrega para crossfade suave sem layout shift. */}
      <div
        aria-hidden={showImage ? "true" : undefined}
        style={{
          backgroundColor: palette.backgroundHex,
          backgroundImage:
            "linear-gradient(155deg, rgba(255, 255, 255, 0.14) 0%, rgba(20, 21, 20, 0.16) 100%)",
          color: palette.inkHex,
        }}
        className="absolute inset-[0_3px_3px_0] flex flex-col justify-between overflow-hidden"
      >
        {/* Faixa de acento editorial no topo */}
        <span
          aria-hidden="true"
          style={{ backgroundColor: palette.accentHex }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[6%] min-h-[4px] max-h-[10px] border-b border-[#141514]/18 opacity-90"
        />

        {/* Moldura fina interna */}
        {!isCompact ? (
          <span
            aria-hidden="true"
            style={{ borderColor: palette.borderHex }}
            className="pointer-events-none absolute inset-[9%_7%_7%_10%] rounded-[2px] border"
          />
        ) : null}

        <div
          aria-hidden="true"
          className={`rf-book-cover-inner relative z-[1] flex h-full w-full flex-col items-center justify-between text-center ${
            isCompact
              ? "px-1 py-1.5 pl-1.5"
              : "px-[14%] pt-[18%] pb-[13%] pl-[16%]"
          }`}
        >
          <p
            data-title-scale={getTitleScale(title)}
            style={{ color: palette.inkHex }}
            className={`rf-book-cover-title my-auto font-serif font-bold tracking-tight ${
              isCompact ? "text-[7px] leading-[1.08]" : ""
            }`}
          >
            {title}
          </p>

          {!isCompact && footerAuthor ? (
            <p
              style={{
                color: palette.inkHex,
                borderColor: palette.borderHex,
              }}
              className="rf-book-cover-author w-full border-t pt-1 font-sans font-semibold tracking-[0.11em] uppercase opacity-85"
            >
              {footerAuthor}
            </p>
          ) : null}
        </div>
      </div>

      {/* 2. Capa real com next/image + crossfade sobre spineColor + guarda naturalWidth < 80 */}
      {showImage && normalizedCoverUrl ? (
        <div className="absolute inset-[0_3px_3px_0] z-[2] overflow-hidden">
          {imageWidth && imageHeight ? (
            <Image
              src={normalizedCoverUrl}
              alt={`Capa de ${title}`}
              width={imageWidth}
              height={imageHeight}
              sizes={resolvedSizes}
              quality={75}
              priority={priority}
              loading={priority ? undefined : "lazy"}
              unoptimized={isDataUrl}
              referrerPolicy="no-referrer"
              onLoad={(event) => {
                const img = event.currentTarget;
                const minValidWidth = isCompact || size === "sm" ? 32 : 80;
                if (img.naturalWidth < minValidWidth) {
                  setFailedState({
                    url: normalizedCoverUrl,
                    reason: "quality",
                  });
                } else {
                  setLoadedUrl(normalizedCoverUrl);
                }
              }}
              onError={() =>
                setFailedState({ url: normalizedCoverUrl, reason: "error" })
              }
              className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${
                isImageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <Image
              src={normalizedCoverUrl}
              alt={`Capa de ${title}`}
              fill
              sizes={resolvedSizes}
              quality={75}
              priority={priority}
              loading={priority ? undefined : "lazy"}
              unoptimized={isDataUrl}
              referrerPolicy="no-referrer"
              onLoad={(event) => {
                const img = event.currentTarget;
                const minValidWidth = isCompact || size === "sm" ? 32 : 80;
                if (img.naturalWidth < minValidWidth) {
                  setFailedState({
                    url: normalizedCoverUrl,
                    reason: "quality",
                  });
                } else {
                  setLoadedUrl(normalizedCoverUrl);
                }
              }}
              onError={() =>
                setFailedState({ url: normalizedCoverUrl, reason: "error" })
              }
              className={`object-cover transition-opacity duration-300 ease-out ${
                isImageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>
      ) : null}

      {/* 3. Acabamento físico em CSS puro sobre qualquer capa (real ou fallback) */}
      {/* Sombra da dobra próxima à lombada */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[10%] min-w-[6px] max-w-[14px]"
        style={{
          background:
            "linear-gradient(90deg, rgba(244, 239, 230, 0.22) 0%, rgba(20, 21, 20, 0.30) 44%, rgba(244, 239, 230, 0.08) 72%, transparent 100%)",
        }}
      />

      {/* Sulco da dobradiça perto da lombada */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[6px] z-[3] w-[2px]"
        style={{
          background:
            "linear-gradient(90deg, rgba(20, 21, 20, 0.44) 0%, rgba(255, 255, 255, 0.24) 55%, rgba(20, 21, 20, 0.14) 100%)",
        }}
      />

      {/* Reflexo diagonal sutil */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[0_3px_3px_0] z-[3]"
        style={{
          background:
            "linear-gradient(126deg, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.05) 28%, transparent 48%, rgba(20, 21, 20, 0.08) 100%)",
        }}
      />

      {/* Borda de páginas creme à direita */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] right-0 bottom-[2px] z-[3] w-[3px]"
        style={{
          background:
            "repeating-linear-gradient(90deg, #F3ECDD 0px, #F3ECDD 1px, #D8CCB6 1px, #D8CCB6 2px)",
          boxShadow: "inset 1px 0 1px rgba(20, 21, 20, 0.22)",
        }}
      />

      {/* Borda de páginas creme embaixo */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-0 left-[2px] z-[3] h-[3px]"
        style={{
          background:
            "repeating-linear-gradient(180deg, #F3ECDD 0px, #F3ECDD 1px, #D8CCB6 1px, #D8CCB6 2px)",
          boxShadow: "inset 0 1px 1px rgba(20, 21, 20, 0.20)",
        }}
      />

      {/* Selo discreto de diagnóstico apenas quando NEXT_PUBLIC_COVER_DEBUG=1 fora de produção */}
      {coverDebugEnabled && devDiagReason && !isCompact ? (
        <span
          aria-hidden="true"
          data-testid="book-cover-dev-badge"
          className="pointer-events-none absolute bottom-2 left-2.5 z-[6] max-w-[calc(100%-16px)] truncate rounded bg-[#141514]/84 px-1.5 py-0.5 font-mono text-[8px] font-semibold tracking-tight text-[#DFBE88] shadow-xs ring-1 ring-[#C8A46E]/45"
        >
          dev: {devDiagReason}
        </span>
      ) : null}

      {/* Borda interna dourada sutil para obra concluída */}
      {isFinished ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px_6px_6px_3px] z-[4] rounded-[2px]"
          style={{ border: "1px solid rgba(212, 175, 55, 0.55)" }}
        />
      ) : null}

      {/* Faixa dourada fina de progresso na base */}
      {showProgressTrack ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[3px] bg-[#141514]/60"
        >
          <span
            className="block h-full transition-all duration-300"
            style={{
              width: `${Math.max(4, safeProgress)}%`,
              background: "linear-gradient(90deg, #D4AF37 0%, #F3E5AB 100%)",
              boxShadow: "0 0 8px rgba(212, 175, 55, 0.8)",
            }}
          />
        </span>
      ) : null}
    </div>
  );
}

export const BookCover = memo(BookCoverBase);
