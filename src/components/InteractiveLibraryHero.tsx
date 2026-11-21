"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ROOM_BOOKS, type RoomBook } from "@/features/shelves/room-books";
import { PendantLamp, SpotlightOverlay } from "@/components/SpotlightOverlay";
import {
  AnalogShelfClock,
  BeigeOrganizerBox,
  DarkVaseBranches,
  NightWindow,
  ShelfMobile,
  UpperRightNicheDecor,
} from "@/components/ShelfRoomObjects";
import { BookShowcaseModal } from "@/components/BookShowcaseModal";
import {
  playBookHoverSound,
  playBookOpenSound,
  toggleRoomLight,
  useRoomState,
} from "@/lib/room-audio";
import { ptBR } from "@/lib/i18n/pt-BR";

interface InteractiveLibraryHeroProps {
  isAuthenticated?: boolean;
}

const TOP_LEFT_BOOKS = ROOM_BOOKS.filter((b) => b.shelf === "top-left");
const MIDDLE_BOOKS = ROOM_BOOKS.filter((b) => b.shelf === "middle");
const BOTTOM_LEFT_BOOKS = ROOM_BOOKS.filter((b) => b.shelf === "bottom-left");

export function InteractiveLibraryHero({
  isAuthenticated = false,
}: InteractiveLibraryHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const { isLightOn } = useRoomState();

  const [hoveredBook, setHoveredBook] = useState<RoomBook | null>(null);
  const [selectedBook, setSelectedBook] = useState<RoomBook | null>(null);
  const activeSpineRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenBook = (book: RoomBook, buttonEl: HTMLButtonElement) => {
    activeSpineRef.current = buttonEl;
    playBookOpenSound();
    setSelectedBook(book);
  };

  const handleCloseModal = useCallback(() => {
    setSelectedBook(null);
    window.setTimeout(() => {
      activeSpineRef.current?.focus();
    }, 20);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#2a2426] select-none">
      {/* =====================================================================
          1. CENÁRIO DE FUNDO: PAREDE SUPERIOR (#2a2426) + BOISERIE (#181c1b)
          ===================================================================== */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Parede superior marrom-acinzentada escura (#2a2426) com vinheta suave */}
        <div
          className="absolute inset-x-0 top-0 h-[62%] lg:h-[58%] bg-[#2a2426]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 42% 32%, rgba(68, 56, 58, 0.38) 0%, rgba(42, 36, 38, 0.92) 62%, #1d181a 100%)",
          }}
        />

        {/* Metade inferior em painéis estilo Boiserie (#181c1b) */}
        <div className="absolute inset-x-0 bottom-0 h-[38%] lg:h-[42%] bg-[#181c1b]">
          {/* Moldura horizontal esculpida (dado / chair rail) */}
          <div className="h-[10px] sm:h-[13px] w-full border-t border-[#323a38] border-b border-[#0d100f] bg-gradient-to-b from-[#262d2b] via-[#1c2120] to-[#121615] shadow-[0_6px_14px_rgba(0,0,0,0.65)]" />

          {/* Grade de molduras clássicas Boiserie */}
          <div className="mx-auto grid h-[calc(100%-44px)] max-w-[1640px] grid-cols-3 gap-3 px-4 py-3 sm:grid-cols-5 sm:gap-5 sm:px-8 lg:grid-cols-6 lg:gap-7 lg:py-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className={`boiserie-panel ${
                  idx >= 3 ? "hidden sm:block" : ""
                } ${idx === 5 ? "sm:hidden lg:block" : ""}`}
              />
            ))}
          </div>

          {/* Rodapé arquitetônico + Piso escuro de madeira */}
          <div className="absolute inset-x-0 bottom-0 h-[28px] sm:h-[36px]">
            <div className="h-[6px] w-full border-t border-[#262d2b]/70 bg-[#101312]" />
            <div
              className="h-[22px] sm:h-[30px] w-full"
              style={{
                background:
                  "linear-gradient(180deg, #1b120e 0%, #130c09 65%, #0c0806 100%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. JANELA NOTURNA À ESQUERDA (CÉU ESTRELADO + LUA BRILHANTE)
          ===================================================================== */}
      <div className="pointer-events-none absolute top-[58px] left-3 z-10 opacity-85 sm:top-[76px] sm:left-6 lg:top-[13%] lg:left-[5%] xl:left-[7%] lg:opacity-100">
        <NightWindow isLightOn={isLightOn} />
      </div>

      {/* =====================================================================
          3. CAMADA DE ESCURECIMENTO DO QUARTO QUANDO A LUMINÁRIA APAGA
          ===================================================================== */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: isLightOn ? 0 : 0.62 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.42 }}
        className="pointer-events-none absolute inset-0 z-20 bg-[#070910]"
      />

      {/* =====================================================================
          4. PALCO CENTRAL: LUMINÁRIA PENDENTE + CONE DE LUZ + ESTANTE DE MADEIRA
          Ancorados no mesmo eixo X para que a luz saia exatamente do bocal
          z-index 35 garante prioridade de pointer events sobre a seção de texto (z-20)
          ===================================================================== */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[35] flex w-[354px] -translate-x-1/2 flex-col justify-end pb-[8px] sm:w-[436px] sm:pb-[8px] lg:left-[39%] lg:w-[476px] lg:pb-[26px] xl:left-[40%] xl:w-[512px] xl:pb-[30px]">
        {/* Luminária Pendente Preta com Cordão Arrastável (drag="y") */}
        <PendantLamp
          isLightOn={isLightOn}
          onToggleLight={() => toggleRoomLight()}
        />

        {/* Cone de Luz Quente (SpotlightOverlay) acoplado ao bocal */}
        <SpotlightOverlay isLightOn={isLightOn} />

        {/* Etiqueta flutuante sutil mostrando o livro sob o cursor/foco */}
        <div className="relative mb-1.5 flex h-7 items-center justify-center">
          <AnimatePresence mode="wait">
            {hoveredBook ? (
              <motion.div
                key={hoveredBook.id}
                initial={
                  prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }
                }
                transition={{ duration: 0.15 }}
                className="rounded-full border border-[rgba(196,167,125,0.42)] bg-[#151210]/92 px-3.5 py-1 text-xs text-[#F4EFE6] shadow-[0_6px_16px_rgba(0,0,0,0.65)]"
              >
                <span className="font-serif font-semibold">
                  {hoveredBook.title}
                </span>
                <span className="mx-1.5 text-[#C4A77D]">·</span>
                <span className="text-[#DFC79C]">{hoveredBook.author}</span>
              </motion.div>
            ) : !isLightOn ? (
              <motion.div
                key="lamp-off-pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-full border border-[rgba(180,200,235,0.28)] bg-[#0E121B]/88 px-3 py-0.5 text-[11px] font-medium text-[#D6E0F5]"
              >
                {ptBR.landingRoom.lampOffBadge}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ESTANTE DE MADEIRA CENTRALIZADA */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto relative w-full transition-[filter] duration-500"
          style={{
            filter: isLightOn
              ? "brightness(1.03)"
              : "brightness(0.58) saturate(0.82)",
          }}
        >
          {/* Objetos no Topo da Estante: Móbile + Relógio Analógico + Vaso com Ramos Secos */}
          <div className="relative z-10 -mb-[1px] flex items-end justify-between px-4 sm:px-7">
            <ShelfMobile />
            <div className="mb-[1px]">
              <AnalogShelfClock />
            </div>
            <DarkVaseBranches isLightOn={isLightOn} />
          </div>

          {/* Cornija / Tampo Superior de Madeira Maciça */}
          <div className="wooden-shelf-cornice -mx-[5px] h-[11px] sm:h-[14px] rounded-[2px]" />

          {/* Corpo Principal da Estante com Nichos Profundos */}
          <div className="wooden-shelf-frame rounded-b-[2px] p-[7px] sm:p-[10px]">
            {/* PRATELEIRA 1 (SUPERIOR): 11 livros claros/coloridos + 1 inclinado | Quadro + Esfera + 3 empilhados */}
            <div className="grid h-[94px] sm:h-[118px] lg:h-[130px] grid-cols-[2.05fr_1fr] grid-rows-1 gap-[7px] sm:gap-[9px]">
              {/* Nicho Superior Esquerdo — position:relative + z-index local garantem que livros
                  com translateY(-10px) no hover saem acima do nicho sem bloquear cliques */}
              <div
                role="group"
                aria-label="Prateleira superior de clássicos"
                className="shelf-niche relative z-10 flex h-full items-end justify-start gap-[1.5px] sm:gap-[2.5px] px-2 pt-3 pb-[1px]"
              >
                {TOP_LEFT_BOOKS.map((book, idx) => (
                  <BookSpineButton
                    key={book.id}
                    book={book}
                    index={idx}
                    onHover={setHoveredBook}
                    onSelect={handleOpenBook}
                  />
                ))}
              </div>

              {/* Nicho Superior Direito */}
              <div className="shelf-niche h-full">
                <UpperRightNicheDecor isLightOn={isLightOn} />
              </div>
            </div>

            {/* Divisória horizontal de madeira maciça */}
            <div className="wooden-shelf-cornice my-[2px] h-[7px] sm:h-[9px] w-full rounded-[1px]" />

            {/* PRATELEIRA 2 (INTERMEDIÁRIA): Livros em tons escuros / couro */}
            <div
              role="group"
              aria-label="Prateleira central de edições encadernadas em couro"
              className="shelf-niche flex h-[86px] sm:h-[108px] lg:h-[118px] items-end justify-between px-3 pt-3 pb-[1px]"
            >
              <div className="flex h-full min-h-0 items-end gap-[2px] sm:gap-[3px]">
                {MIDDLE_BOOKS.map((book, idx) => (
                  <BookSpineButton
                    key={book.id}
                    book={book}
                    index={idx + 12}
                    onHover={setHoveredBook}
                    onSelect={handleOpenBook}
                  />
                ))}
              </div>

              {/* Aparador de livros discreto em latão envelhecido à direita */}
              <div
                aria-hidden="true"
                className="hidden sm:flex flex-col items-end justify-end pr-2 pb-[1px] opacity-85"
              >
                <div className="h-[34px] w-[14px] rounded-t-full border border-[#B0905A]/45 bg-gradient-to-b from-[#A5844E] to-[#523E20] shadow-md" />
                <div className="h-[4px] w-[26px] bg-[#6E542B]" />
              </div>
            </div>

            {/* Divisória horizontal de madeira maciça */}
            <div className="wooden-shelf-cornice my-[2px] h-[7px] sm:h-[9px] w-full rounded-[1px]" />

            {/* PRATELEIRA 3 (INFERIOR): Livros em couro escuro + Caixa organizadora bege */}
            <div className="grid h-[84px] sm:h-[104px] lg:h-[114px] grid-cols-[1.45fr_1fr] grid-rows-1 gap-[7px] sm:gap-[9px]">
              <div
                role="group"
                aria-label="Prateleira inferior de clássicos mundiais"
                className="shelf-niche flex h-full items-end gap-[2px] sm:gap-[3px] px-2.5 pt-3 pb-[1px]"
              >
                {BOTTOM_LEFT_BOOKS.map((book, idx) => (
                  <BookSpineButton
                    key={book.id}
                    book={book}
                    index={idx + 20}
                    onHover={setHoveredBook}
                    onSelect={handleOpenBook}
                  />
                ))}
              </div>

              {/* Canto Inferior Direito: Caixa Organizadora Bege */}
              <div className="shelf-niche h-full">
                <BeigeOrganizerBox />
              </div>
            </div>
          </div>

          {/* Rodapé maciço da estante (plinto) + sombra de contato no chão */}
          <div className="mx-[2px] h-[10px] sm:h-[14px] rounded-b-[2px] bg-gradient-to-b from-[#2A190F] to-[#140B06] shadow-[0_10px_24px_rgba(0,0,0,0.92)]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-3 -inset-x-5 h-5 rounded-full bg-black/75 blur-md"
          />
        </motion.div>
      </div>

      {/* =====================================================================
          5. DIREITA DA ESTANTE: TIPOGRAFIA EDITORIAL GRANDE + REFLEXO DA JANELA
          z-20 (< z-35 da estante) garante que livros recebam cliques sobre o texto no mobile
          ===================================================================== */}
      <section
        aria-label="Apresentação do ReadingFlow"
        className="pointer-events-none absolute inset-x-0 top-[138px] z-20 flex flex-col items-center px-4 text-center sm:top-[148px] lg:top-[45%] lg:inset-x-auto lg:right-[4%] lg:bottom-auto lg:-translate-y-1/2 lg:items-end lg:px-0 lg:text-right xl:right-[6%]"
      >
        {/* Sombra / Reflexo suave e inclinado da janela projetado sobre a tipografia na parede */}
        <div
          aria-hidden="true"
          className="window-wall-reflection hidden lg:grid absolute -top-10 -right-2 h-[270px] w-[340px] grid-cols-2 grid-rows-3 gap-3 p-3 transition-opacity duration-500"
          style={{
            opacity: isLightOn ? 0.14 : 0.28,
          }}
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-[2px] bg-gradient-to-br from-[#D6E4FF]/55 via-[#B8C9EA]/20 to-transparent"
            />
          ))}
        </div>

        {/* Tipografia Principal */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto relative max-w-[430px]"
        >
          <h1 className="font-serif text-[2.15rem] sm:text-5xl lg:text-[4rem] xl:text-[4.65rem] font-semibold leading-[0.94] tracking-tight text-[#EDE3D2] drop-shadow-[0_4px_26px_rgba(0,0,0,0.65)]">
            ReadingFlow
            <span className="sr-only"> — {ptBR.landingRoom.tagline}</span>
          </h1>

          <p
            aria-hidden="true"
            className="mt-1 sm:mt-2 font-serif text-base sm:text-xl lg:text-2xl italic font-medium text-[#DFC79C]"
          >
            {ptBR.landingRoom.tagline}
          </p>

          <p className="hidden lg:block mt-3 ml-auto max-w-[34ch] text-sm leading-relaxed text-[#D8CCB8]">
            {ptBR.landingRoom.subtitle}
          </p>

          <div className="mt-2.5 sm:mt-4 lg:mt-6 flex flex-wrap items-center justify-center gap-2.5 lg:justify-end">
            <Link
              href={isAuthenticated ? "/painel" : "/entrar"}
              className="inline-flex min-h-[38px] sm:min-h-[44px] items-center justify-center rounded-full bg-[#C4A77D] px-5 sm:px-6 text-xs sm:text-sm font-bold text-[#12100E] shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:bg-[#D5B98E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4EFE6]"
            >
              {isAuthenticated
                ? ptBR.landingRoom.authenticatedCta
                : ptBR.landingRoom.primaryCta}
            </Link>
          </div>

          <p className="mt-1.5 sm:mt-3 font-serif text-xs sm:text-sm italic text-[#CBBFA9]">
            <span className="hidden sm:inline">
              {ptBR.landingRoom.hintDesktop}
            </span>
            <span className="sm:hidden">{ptBR.landingRoom.hintMobile}</span>
          </p>
        </motion.div>
      </section>

      {/* =====================================================================
          6. MODAL SHOWCASE 3D AO CLICAR EM QUALQUER LIVRO DA ESTANTE
          ===================================================================== */}
      <BookShowcaseModal
        book={selectedBook}
        isAuthenticated={isAuthenticated}
        onClose={handleCloseModal}
      />
    </div>
  );
}

interface BookSpineButtonProps {
  book: RoomBook;
  index: number;
  onHover: (book: RoomBook | null) => void;
  onSelect: (book: RoomBook, buttonEl: HTMLButtonElement) => void;
}

function BookSpineButton({
  book,
  index,
  onHover,
  onSelect,
}: BookSpineButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Abrir livro ${book.title}, de ${book.author}`}
      onMouseEnter={() => {
        onHover(book);
        playBookHoverSound(index);
      }}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(book)}
      onBlur={() => onHover(null)}
      onClick={(e) => onSelect(book, e.currentTarget)}
      style={
        {
          height: `${book.heightPct}%`,
          width: `${book.widthPx}px`,
          flex: `0 0 ${book.widthPx}px`,
          backgroundColor: book.color,
          color: book.textColor,
        } as CSSProperties
      }
      className={`lr-book-prism book-spine min-w-[24px] px-[1px] py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4EFE6] ${
        book.isLeaning ? "is-leaning" : ""
      }`}
    >
      <span className="pointer-events-none block max-h-full overflow-hidden font-serif text-[9px] sm:text-[10.5px] font-semibold leading-none tracking-tight whitespace-nowrap text-ellipsis">
        {book.spineLabel}
      </span>
    </button>
  );
}
