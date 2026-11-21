"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-BR";
import {
  MarketingMobileSessionActions,
  MarketingSessionActions,
  useMarketingSession,
} from "@/components/MarketingSessionActions";

export function MarketingHeader() {
  const prefersReducedMotion = useReducedMotion();
  const session = useMarketingSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <header
      data-scrolled={isScrolled ? "true" : "false"}
      className={`rf-marketing-header fixed inset-x-0 top-0 z-40 border-b border-[var(--rf-nav-border)] bg-[var(--rf-nav-bg-marketing)] pt-[env(safe-area-inset-top)] text-[var(--rf-nav-text)] transition-shadow duration-200 ${
        isScrolled ? "shadow-[var(--rf-nav-shadow-scrolled)]" : ""
      }`}
    >
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1520px] items-center justify-between gap-2 px-3 sm:px-8">
        {/* Esquerda: Marca + Âncoras da landing */}
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link
            href="/"
            aria-label="ReadingFlow"
            className="shrink-0 rounded-[var(--rf-radius-xs)] px-0.5 font-sans text-base sm:text-xl font-semibold tracking-tight text-[var(--rf-nav-text)] hover:text-[var(--rf-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            ReadingFlow
          </Link>

          <nav
            aria-label="Seções da página"
            className="hidden lg:flex items-center gap-5"
          >
            <Link
              href="/#sobre"
              aria-label="Sobre o ReadingFlow"
              className="rounded-[var(--rf-radius-xs)] px-1.5 py-1 font-sans text-[13px] font-semibold tracking-wide text-[var(--rf-nav-text-marketing)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              Sobre
            </Link>
            <Link
              href="/#funcionalidades"
              aria-label="Funcionalidades do ReadingFlow"
              className="rounded-[var(--rf-radius-xs)] px-1.5 py-1 font-sans text-[13px] font-semibold tracking-wide text-[var(--rf-nav-text-marketing)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              Funcionalidades
            </Link>
            <Link
              href="/#faq"
              aria-label="Perguntas frequentes (FAQ)"
              className="rounded-[var(--rf-radius-xs)] px-1.5 py-1 font-sans text-[13px] font-semibold tracking-wide text-[var(--rf-nav-text-marketing)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              FAQ
            </Link>
            <Link
              href="/#contato"
              aria-label="Ir para contato e privacidade"
              className="rounded-[var(--rf-radius-xs)] px-1.5 py-1 font-sans text-[13px] font-semibold tracking-wide text-[var(--rf-nav-text-marketing)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              {ptBR.landingRoom.contactLink}
            </Link>
          </nav>
        </div>

        {/* Direita: Ilha de sessão (largura reservada sem layout shift) + Menu Mobile */}
        <div
          ref={menuContainerRef}
          className="relative flex shrink-0 items-center gap-1.5 sm:gap-3"
        >
          <MarketingSessionActions session={session} />

          {/* Botão de Menu Hambúrguer (oculto em telas desktop lg:hidden) */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={
              menuOpen ? ptBR.landingRoom.closeMenu : ptBR.landingRoom.openMenu
            }
            className="flex lg:hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-alt)] text-[var(--rf-nav-text)] hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            {menuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Menu Suspenso Minimalista Mobile com mesmas ações de sessão */}
          <AnimatePresence>
            {menuOpen ? (
              <motion.div
                role="menu"
                aria-label="Menu de navegação móvel"
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: -6, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -4, scale: 0.98 }
                }
                transition={{ duration: 0.16 }}
                className="lg:hidden absolute top-11 right-0 z-50 w-60 rounded-[var(--rf-radius-lg)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-bg-marketing)] p-2.5 font-sans text-sm text-[var(--rf-nav-text)] shadow-[var(--rf-nav-modal-shadow)]"
              >
                <MarketingMobileSessionActions
                  session={session}
                  onNavigate={() => setMenuOpen(false)}
                />

                <div className="my-2 h-[1px] bg-[var(--rf-nav-border)]" />

                <Link
                  href="/#sobre"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-text)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {ptBR.landingRoom.aboutLink}
                </Link>
                <Link
                  href="/#funcionalidades"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-text)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  Funcionalidades
                </Link>
                <Link
                  href="/#faq"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-text)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  FAQ
                </Link>
                <Link
                  href="/#contato"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-text)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {ptBR.landingRoom.contactLink}
                </Link>

                <div className="my-2 h-[1px] bg-[var(--rf-nav-border)]" />

                <Link
                  href="/ajuda"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-medium text-[var(--rf-nav-text-muted)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {ptBR.landingRoom.helpLink}
                </Link>
                <Link
                  href="/termos"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-medium text-[var(--rf-nav-text-muted)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {ptBR.landingRoom.termsLink}
                </Link>
                <Link
                  href="/privacidade"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-medium text-[var(--rf-nav-text-muted)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {ptBR.landingRoom.privacyLink}
                </Link>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
