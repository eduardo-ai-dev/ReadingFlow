"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { LandingHeroLayout } from "@/lib/landing-layouts";
import { useHeroRotator } from "@/hooks/useHeroRotator";
import styles from "./HeroRotator.module.css";

interface HeroRotatorProps {
  layouts: readonly LandingHeroLayout[];
  isAuthenticated?: boolean;
}

/**
 * HeroRotator — Exibe um cenário aleatório da landing page (descoberto em `public/landing-layouts/`)
 * a cada recarregamento da página (F5), sem repetir a imagem anterior e sem controles de carrossel:
 * - Render inicial / SSR: `activeIndex = null` mantendo o fundo Onyx (#141514) sem erro de hidratação.
 * - Ao montar no cliente: sorteia um índice diferente do último salvo em `sessionStorage` e revela
 *   a imagem com fade suave (`opacity-0` -> `opacity-100`, `duration-500`).
 */
export function HeroRotator({
  layouts,
  isAuthenticated = false,
}: HeroRotatorProps) {
  const count = layouts.length;
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const { activeIndex, prefersReducedMotion } = useHeroRotator(count);

  const activeLayout =
    activeIndex !== null ? (layouts[activeIndex] ?? null) : null;
  const isImageLoaded = Boolean(
    activeLayout && loadedSrc === activeLayout.src
  );

  const imagePositionVars = activeLayout
    ? ({
        "--hero-pos-desktop": activeLayout.objectPosition,
        "--hero-pos-mobile": activeLayout.mobileObjectPosition,
      } as CSSProperties)
    : undefined;

  return (
    <section
      aria-label="Apresentação do ReadingFlow"
      data-hero-rotator="true"
      data-hero-count={count}
      data-hero-active-index={activeIndex !== null ? activeIndex : undefined}
      className={styles.heroSection}
    >
      {/* 1. Imagem de fundo sorteada no cliente (inicia em opacity-0 sobre #141514 e faz fade-in suave duration-500) */}
      {activeLayout ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            data-hero-layout={activeLayout.filename}
            className={`${styles.imageLayer} transition-opacity duration-500 ease-out motion-reduce:transition-none ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={imagePositionVars}
          >
            <Image
              src={activeLayout.src}
              alt={activeLayout.alt}
              fill
              priority
              fetchPriority="high"
              quality={90}
              sizes="100vw"
              onLoad={() => setLoadedSrc(activeLayout.src)}
            />
          </div>
        </div>
      ) : null}

      {/* 2. Scrim em gradiente Onyx -> transparente (contraste AA garantido em imagens claras ou escuras) */}
      <div aria-hidden="true" className={styles.scrim} />

      {/* 3. Hotspots opcionais nos nichos (somente quando o layout ativo definir coordenadas no manifest) */}
      {activeLayout && activeLayout.hotspots.length > 0 ? (
        <div
          aria-label={`Destaques do cenário ${activeLayout.label}`}
          className="pointer-events-none absolute inset-0 z-[9] hidden lg:block"
        >
          {activeLayout.hotspots.map((hotspot) => {
            const isOpen = openHotspotId === hotspot.id;
            return (
              <div
                key={`${activeLayout.id}-${hotspot.id}`}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={hotspot.label}
                  onClick={() =>
                    setOpenHotspotId((curr) =>
                      curr === hotspot.id ? null : hotspot.id
                    )
                  }
                  className="rf-icon-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#C8A46E] bg-[#141514]/80 text-[#F4EFE6] shadow-md backdrop-blur-sm transition-colors hover:bg-[#C8A46E] hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141514]"
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                </button>

                {isOpen ? (
                  <div
                    role="note"
                    className="mt-2 w-56 rounded-xl border border-[#C8A46E]/40 bg-[#141514]/92 p-3 font-sans text-left text-[#F4EFE6] shadow-xl backdrop-blur-md"
                  >
                    <p className="text-[13px] font-semibold text-[#DFBE88]">
                      {hotspot.label}
                    </p>
                    {hotspot.description ? (
                      <p className="mt-1 text-[13px] leading-snug text-[#F4EFE6]">
                        {hotspot.description}
                      </p>
                    ) : null}
                    {hotspot.href ? (
                      <Link
                        href={hotspot.href}
                        className="mt-2 inline-flex text-[13px] font-semibold text-[#C8A46E] hover:text-[#DFBE88] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                      >
                        Explorar →
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 4. Conteúdo HTML fixo sobre a imagem (título Playfair Display, slogan e CTA em posição estável) */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 pt-16 pb-28 lg:pointer-events-none lg:block lg:p-0">
        <div className="pointer-events-auto flex max-w-[460px] flex-col items-center text-center lg:absolute lg:top-[18%] lg:right-[5%] lg:w-[34%] lg:max-w-[480px] xl:right-[6%] xl:w-[32%]">
          {/* Se um layout específico tiver "ReadingFlow" embutido na imagem, preserva o h1 só para leitores de tela */}
          <h1
            className={
              activeLayout?.hasEmbeddedBrandText
                ? "sr-only"
                : "font-serif text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-balance text-[#F4EFE6] drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)] sm:text-[3.5rem] lg:text-[64px]"
            }
          >
            ReadingFlow
          </h1>

          {/* Fio editorial + Slogan sem serifa para legibilidade e contraste AA */}
          <div className="flex flex-col items-center">
            {!activeLayout?.hasEmbeddedBrandText ? (
              <div
                aria-hidden="true"
                className="my-3.5 flex items-center justify-center gap-3 text-[#C8A46E]"
              >
                <div className="h-[1px] w-14 bg-gradient-to-r from-transparent via-[#C8A46E]/80 to-[#C8A46E]" />
                <span className="font-sans text-xs">✦</span>
                <div className="h-[1px] w-14 bg-gradient-to-l from-transparent via-[#C8A46E]/80 to-[#C8A46E]" />
              </div>
            ) : null}

            <p className="font-sans text-lg font-medium tracking-tight text-balance text-[#DFBE88] drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] sm:text-xl lg:text-[22px]">
              {ptBR.landingRoom.tagline}
            </p>
          </div>

          <p className="mt-3.5 max-w-[38ch] font-sans text-sm leading-relaxed text-[#F4EFE6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-[16px]">
            {ptBR.landingRoom.subtitle}
          </p>

          {/* CTA Primário Camel (#C8A46E com texto Onyx #141514) */}
          <div className="mt-6 flex flex-wrap items-center justify-center">
            <Link
              href={isAuthenticated ? "/estantes" : "/entrar"}
              aria-label="Abrir Minha Estante"
              className="rf-cta-btn inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#C8A46E] px-8 py-3 font-sans text-[15px] font-semibold text-[#141514] shadow-[0_8px_24px_rgba(0,0,0,0.65)] transition-colors hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141514]"
            >
              Abrir Minha Estante
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Indicador discreto de rolagem na base (centro inferior intacto) */}
      <button
        type="button"
        aria-label="Rolar para a próxima seção"
        onClick={() => {
          document
            .getElementById("sobre")
            ?.scrollIntoView({
              behavior: prefersReducedMotion ? "auto" : "smooth",
            });
        }}
        className="rf-icon-btn absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-1 rounded-full border border-[#C8A46E]/30 bg-[#141514]/70 px-3 py-2 font-sans text-[#DFBE88] backdrop-blur-sm transition-colors hover:bg-[#141514]/90 hover:text-[#F4EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] lg:bottom-5"
      >
        <ChevronDown className="h-4 w-4 text-[#DFBE88]" aria-hidden="true" />
      </button>

      {/* Filete editorial inferior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[1px] bg-[#C8A46E]/30"
      />
    </section>
  );
}
