"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-BR";

interface LandingHeroClientProps {
  isAuthenticated?: boolean;
}

/**
 * LandingHeroClient — Composição visual estática 2D em tela cheia real (100dvh / 4K)
 * - Hero 100% viewport (min-h-screen h-[100dvh]) sem faixa clara no rodapé da primeira dobra
 * - Efeito Ken Burns sutil (1.0 -> 1.04 em 20s) e respiração quente na região do abajur
 * - Entrada escalonada fade-in-up (cubic-bezier(0.22, 1, 0.36, 1))
 * - Indicador discreto de rolagem na base (#DFBE88)
 */
export function LandingHeroClient({
  isAuthenticated = false,
}: LandingHeroClientProps) {
  return (
    <section
      aria-label="Apresentação do ReadingFlow"
      className="relative h-[100dvh] min-h-[100dvh] w-full overflow-hidden border-b border-[#C8A46E]/30 bg-[#141514]"
    >
      {/* 1. Imagem 4K otimizada via next/image (WebP/AVIF, preload, fill, quality=85, sem zoom que reamostre) */}
      <div className="absolute inset-0 h-full w-full">
        <Image
          src="/hero-library-4k.webp"
          alt="Cenário clássico de biblioteca noturna com janela em arco iluminada pela lua à esquerda, estante de madeira escura ao centro e poltrona de couro com abajur à direita"
          fill
          preload
          quality={85}
          sizes="100vw"
          className="h-full w-full object-cover object-center select-none"
        />
      </div>

      {/* 2. Brilho quente respirando suavemente na região do abajur (canto inferior direito) */}
      <div
        aria-hidden="true"
        className="rf-lamp-glow motion-reduce:animate-none pointer-events-none absolute right-[2%] bottom-[16%] z-[5] h-[260px] w-[260px] sm:h-[320px] sm:w-[320px] rounded-full"
      />

      {/* 3. Camada de Gradiente Suave para Contraste e Legibilidade na Parede Direita */}
      <div
        aria-hidden="true"
        className="rf-hero-static-overlay pointer-events-none absolute inset-0 z-[6]"
      />

      {/* 4. Bloco Tipográfico Vetorial Playfair Display com Entrada Escalonada */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 pt-16 pb-20 lg:pointer-events-none lg:block lg:p-0">
        <div className="pointer-events-auto flex max-w-[460px] flex-col items-center text-center lg:absolute lg:top-[16%] lg:right-[5%] lg:w-[32%] lg:max-w-[480px] xl:right-[6%] xl:w-[30%]">
          {/* Título Principal Vetorial (Playfair Display, 64px SemiBold, #F4EFE6) */}
          <h1 className="rf-stagger-1 font-serif text-[2.75rem] sm:text-[3.5rem] lg:text-[64px] font-semibold leading-[1.05] tracking-tight text-balance text-[#F4EFE6] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">
            ReadingFlow
          </h1>

          {/* Fio Clássico Decorativo + Subtítulo em Itálico (#DFBE88) */}
          <div className="rf-stagger-2 flex flex-col items-center">
            <div
              aria-hidden="true"
              className="my-3.5 flex items-center justify-center gap-3 text-[#C8A46E]"
            >
              <div className="h-[1px] w-14 bg-gradient-to-r from-transparent via-[#C8A46E]/75 to-[#C8A46E]" />
              <span className="text-xs">✦</span>
              <div className="h-[1px] w-14 bg-gradient-to-l from-transparent via-[#C8A46E]/75 to-[#C8A46E]" />
            </div>

            <p className="font-serif text-xl sm:text-2xl lg:text-[28px] italic font-normal text-balance text-[#DFBE88] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {ptBR.landingRoom.tagline}
            </p>
          </div>

          {/* Descrição Breve */}
          <p className="rf-stagger-3 mt-4 max-w-[36ch] font-sans text-sm sm:text-[17px] leading-relaxed text-[#F4EFE6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
            {ptBR.landingRoom.subtitle}
          </p>

          {/* Botão Primário Sólido "Abrir Minha Estante" (#C8A46E com texto #141514) */}
          <div className="rf-stagger-4 mt-6 flex flex-wrap items-center justify-center">
            <Link
              href={isAuthenticated ? "/estantes" : "/entrar"}
              aria-label="Abrir Minha Estante"
              className="rf-cta-btn inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#C8A46E] px-8 py-3 font-sans text-[16px] font-semibold text-[#141514] shadow-[0_8px_24px_rgba(0,0,0,0.75)] hover:bg-[#DFBE88] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141514] transition-all active:scale-[0.98]"
            >
              Abrir Minha Estante
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Indicador Interativo de Rolagem na Base (#DFBE88 com fundo translúcido bg-[#141514]/60 backdrop-blur-sm e motion-reduce:animate-none) */}
      <button
        type="button"
        aria-label="Rolar para a próxima seção"
        onClick={() => {
          document
            .getElementById("sobre")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
        className="rf-icon-btn absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex min-h-[44px] min-w-[44px] -translate-x-1/2 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border border-[#C8A46E]/30 bg-[#141514]/60 px-3 py-2 font-sans text-[#DFBE88] backdrop-blur-sm transition-transform duration-300 hover:translate-y-1 hover:bg-[#141514]/80 hover:text-[#F4EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] motion-reduce:animate-none motion-reduce:transition-none"
      >
        <span className="rf-scroll-pulse motion-reduce:animate-none flex flex-col items-center gap-1">
          <span className="h-5 w-[1px] bg-gradient-to-b from-transparent via-[#DFBE88]/80 to-[#DFBE88]" />
          <ChevronDown className="h-4 w-4 text-[#DFBE88]" aria-hidden="true" />
        </span>
      </button>

      {/* Filete editorial sutil (#C8A46E/30) na transição entre a base escura do Hero (#141514) e a seção clara Sobre (#F4EFE6) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[1px] bg-[#C8A46E]/30"
      />
    </section>
  );
}
