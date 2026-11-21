"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { RotateCw, X } from "lucide-react";
import type { RoomBook } from "@/features/shelves/room-books";
import { ptBR } from "@/lib/i18n/pt-BR";

interface BookShowcaseModalProps {
  book: RoomBook | null;
  isAuthenticated: boolean;
  onClose: () => void;
}

export function BookShowcaseModal({
  book,
  isAuthenticated,
  onClose,
}: BookShowcaseModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [demoPages, setDemoPages] = useState<number>(0);

  // Física de inclinação 3D interativa ao mover o cursor sobre o livro
  const rotXRaw = useMotionValue(-6);
  const rotYRaw = useMotionValue(-22);
  const rotX = useSpring(rotXRaw, { stiffness: 220, damping: 24 });
  const rotY = useSpring(rotYRaw, { stiffness: 220, damping: 24 });

  useEffect(() => {
    if (!book) return;
    rotXRaw.set(-6);
    rotYRaw.set(-22);

    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [book, onClose, rotXRaw, rotYRaw]);

  // Inicializa progresso demonstrativo em ~35% das páginas do livro aberto
  const initialPages = book ? Math.round(book.pages * 0.35) : 0;
  const effectivePages =
    book && demoPages > 0 && demoPages <= book.pages ? demoPages : initialPages;
  const pct = book ? Math.round((effectivePages / book.pages) * 100) : 0;
  const readingStateLabel =
    pct === 0
      ? ptBR.readingStatus.not_started
      : pct >= 100
        ? ptBR.readingStatus.finished
        : ptBR.readingStatus.reading;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    const baseAngle = isFlipped ? 158 : -22;
    rotYRaw.set(baseAngle + nx * 38);
    rotXRaw.set(-6 - ny * 24);
  };

  const handlePointerLeave = () => {
    rotYRaw.set(isFlipped ? 158 : -22);
    rotXRaw.set(-6);
  };

  const toggleFlip = () => {
    const next = !isFlipped;
    setIsFlipped(next);
    rotYRaw.set(next ? 158 : -22);
  };

  return (
    <AnimatePresence>
      {book ? (
        <motion.div
          key="book-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.22 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsFlipped(false);
              setDemoPages(0);
              onClose();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-3 sm:p-6 backdrop-blur-[3px]"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="showcase-book-title"
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.95, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 10 }
            }
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="hero-dialog-card relative grid max-h-[calc(100dvh-24px)] w-full max-w-[820px] grid-cols-1 gap-5 overflow-y-auto rounded-[12px] border border-[rgba(196,167,125,0.32)] bg-[#181512] p-5 text-[#F4EFE6] shadow-[0_28px_72px_rgba(0,0,0,0.88)] md:grid-cols-[270px_1fr] md:gap-8 md:p-8"
          >
            {/* Botão Fechar */}
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="Fechar"
              onClick={() => {
                setIsFlipped(false);
                setDemoPages(0);
                onClose();
              }}
              className="absolute top-3.5 right-3.5 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[rgba(196,167,125,0.34)] bg-[#12100E] text-[#F4EFE6] hover:border-[#C4A77D] hover:text-[#C4A77D] focus-visible:outline-2 focus-visible:outline-[#C4A77D]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Coluna Esquerda: Prisma do Livro 3D Interativo */}
            <div className="flex flex-col items-center justify-center rounded-[10px] border border-[rgba(196,167,125,0.14)] bg-gradient-to-b from-[#211C18] to-[#120F0D] py-5 px-3">
              <div
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                style={
                  {
                    perspective: "1100px",
                    "--bw": "168px",
                    "--bh": "244px",
                    "--depth": "42px",
                    "--c": book.coverColor,
                    "--txt": book.coverTextColor,
                  } as CSSProperties
                }
                className="relative flex h-[264px] w-[220px] cursor-grab items-center justify-center active:cursor-grabbing select-none"
              >
                <motion.div
                  style={{
                    width: "var(--bw)",
                    height: "var(--bh)",
                    transformStyle: "preserve-3d",
                    rotateX: rotX,
                    rotateY: rotY,
                  }}
                  className="relative"
                >
                  {/* Face 1: Capa Frontal */}
                  <div className="rf-face-front-cover">
                    <div className="flex h-full flex-col justify-between p-3 text-center">
                      <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#C4A77D]">
                        {book.wing}
                      </span>
                      <div>
                        <span className="block font-serif text-xl font-semibold leading-tight text-[#F4EFE6]">
                          {book.title}
                        </span>
                        <span className="my-2.5 mx-auto block h-[1px] w-8 bg-[#C4A77D]/60" />
                        <span className="block font-serif text-xs italic text-[#DFC79C]">
                          {book.author}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] tracking-widest uppercase text-[#C4A77D]">
                        <span>Nº {book.num}</span>
                        <span>ReadingFlow</span>
                      </div>
                    </div>
                  </div>

                  {/* Face 2: Quarta Capa (Verso) */}
                  <div className="rf-face-back-cover flex flex-col justify-between p-4 text-left">
                    <span className="text-[9px] font-semibold tracking-widest uppercase text-[#C4A77D]">
                      Edição Catalogada
                    </span>
                    <p className="font-serif text-[11px] leading-relaxed text-[#E8DEC8] line-clamp-6">
                      {book.synopsis}
                    </p>
                    <span className="text-[9px] tracking-widest uppercase text-[#C4A77D]">
                      {book.pages} páginas · {book.formatLabel}
                    </span>
                  </div>

                  {/* Face 3: Lombada */}
                  <div className="rf-face-spine-left-full">
                    <span className="rf-showcase-spine-title">{book.title}</span>
                  </div>

                  {/* Faces 4, 5, 6: Bloco de páginas */}
                  <span className="rf-face-right-pages-full" />
                  <span className="rf-face-top-pages-full" />
                  <span className="rf-face-bottom-pages-full" />
                </motion.div>

                <div className="rf-showcase-shadow" />
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleFlip}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(196,167,125,0.35)] bg-[#191512] px-3 py-1 text-xs font-semibold text-[#EADFCB] hover:border-[#C4A77D] hover:text-[#C4A77D]"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {ptBR.landingRoom.modalSpinBtn}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-[#BFB3A3]">
                {ptBR.landingRoom.modalInspectHint}
              </p>
            </div>

            {/* Coluna Direita: Ficha Editorial + Microinteração de Leitura */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 pr-8 text-xs font-semibold text-[#D4B98C]">
                  <span className="rounded-full border border-[rgba(196,167,125,0.35)] bg-[#231E1A] px-2.5 py-0.5">
                    {book.wing}
                  </span>
                  <span>·</span>
                  <span>{book.formatLabel}</span>
                  <span>·</span>
                  <span>{book.pages} págs.</span>
                </div>

                <h2
                  id="showcase-book-title"
                  className="mt-2.5 font-serif text-2xl sm:text-3xl font-semibold leading-tight text-[#F4EFE6]"
                >
                  {book.title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#C4A77D]">
                  {book.author}
                </p>

                <p className="mt-3.5 font-serif text-base sm:text-[17px] leading-relaxed text-[#EAE0D0]">
                  {book.synopsis}
                </p>

                {/* Microinteração demonstrativa: Experimente registrar páginas */}
                <div className="mt-5 rounded-[10px] border border-[rgba(196,167,125,0.22)] bg-[#211C18] p-3.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label
                      htmlFor="demo-reading-range"
                      className="font-semibold text-[#EADFCB]"
                    >
                      {ptBR.landingRoom.modalProgressLabel}
                    </label>
                    <span className="rounded-full bg-[#12100E] px-2.5 py-0.5 font-semibold text-[#D4B98C]">
                      {readingStateLabel} · {pct}%
                    </span>
                  </div>

                  <input
                    id="demo-reading-range"
                    type="range"
                    min={0}
                    max={book.pages}
                    value={effectivePages}
                    onChange={(e) => setDemoPages(Number(e.target.value))}
                    className="mt-2.5 h-2 w-full cursor-pointer accent-[#C4A77D]"
                  />

                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#C8BCA9]">
                    <span>
                      Página <strong>{effectivePages}</strong> de {book.pages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDemoPages(book.pages)}
                      className="cursor-pointer font-semibold text-[#DFC79C] underline decoration-[#C4A77D]/50 underline-offset-2 hover:text-[#F4EFE6]"
                    >
                      Marcar concluído
                    </button>
                  </div>
                </div>
              </div>

              {/* Ações Principais */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={isAuthenticated ? "/adicionar" : "/criar-conta"}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#C4A77D] px-5 text-xs sm:text-sm font-bold text-[#12100E] shadow-[0_4px_14px_rgba(196,167,125,0.25)] hover:bg-[#D5B98E] focus-visible:outline-2 focus-visible:outline-[#F4EFE6]"
                >
                  {ptBR.landingRoom.modalAddCta}
                </Link>

                {!isAuthenticated ? (
                  <Link
                    href="/entrar"
                    className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[rgba(196,167,125,0.4)] bg-transparent px-4 text-xs sm:text-sm font-semibold text-[#F4EFE6] hover:bg-[rgba(196,167,125,0.12)]"
                  >
                    {ptBR.landingRoom.primaryCta}
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setIsFlipped(false);
                    setDemoPages(0);
                    onClose();
                  }}
                  className="inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-full border border-transparent px-3 text-xs sm:text-sm font-semibold text-[#C8BCA9] hover:text-[#F4EFE6]"
                >
                  {ptBR.landingRoom.modalBackBtn}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

