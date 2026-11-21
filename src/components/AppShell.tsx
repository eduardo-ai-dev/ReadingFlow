"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import type { UserProfile } from "@/lib/domain";
import { ptBR } from "@/lib/i18n/pt-BR";
import { signOutAction } from "@/features/auth/actions";
import { UndoBanner } from "@/components/UndoBanner";
import {
  MastheadNav,
  isNavActive,
  MASTHEAD_NAV_ITEMS,
  MOBILE_EXTRA_ITEMS,
} from "@/components/MastheadNav";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { Button } from "@/components/ui/Button";
import { LibraryBackdrop } from "@/components/layout/LibraryBackdrop";
import { Plus, User, Settings, LogOut, Menu, X } from "lucide-react";

const MOBILE_BOTTOM_NAV = [
  { href: "/painel", label: "Mesa" },
  { href: "/estante-3d", label: "Estante 3D" },
  { href: "/leitura/foco", label: "Foco" },
  { href: "/explorar", label: "Explorar" },
  { href: "/evolucao", label: "Evolução" },
] as const;

export function AppShell({
  profile,
  undoInfo,
  children,
}: {
  profile: UserProfile;
  undoInfo: { id: string; label: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isSigningOut, startSignOut] = useTransition();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuBtnRef = useRef<HTMLButtonElement>(null);
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);

  // Fecha o menu de conta ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

  // Fecha menus abertos ao pressionar Escape e restaura foco ao botão disparador
  useEffect(() => {
    if (!accountMenuOpen && !mobileMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (accountMenuOpen) {
        e.preventDefault();
        setAccountMenuOpen(false);
        accountMenuBtnRef.current?.focus();
      } else if (mobileMenuOpen) {
        e.preventDefault();
        setMobileMenuOpen(false);
        mobileMenuBtnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [accountMenuOpen, mobileMenuOpen]);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }

  const handleSignOut = () => {
    startSignOut(async () => {
      await signOutAction();
      router.push("/");
    });
  };

  return (
    <div className="relative min-h-dvh text-[var(--rf-text-primary)]">
      {/* Estantes arquitetônicas lineares emoldurando as laterais em monitores widescreen */}
      <LibraryBackdrop variant="app" />

      <a href="#conteudo-principal" className="skip-link">
        {ptBR.nav.skipToContent}
      </a>

      {/* ====================================================================
          MASTHEAD EDITORIAL SUPERIOR (HORIZONTAL)
          Largura sincronizada com a folha editorial central (max-w-[1360px]).
          ==================================================================== */}
      <header className="sticky top-0 z-50 border-b border-[var(--rf-nav-border-accent)] bg-[var(--rf-nav-bg)] pt-[env(safe-area-inset-top)] text-[var(--rf-nav-text)] shadow-[var(--rf-nav-shadow)]">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          {/* 1. ESQUERDA: Logotipo serifado com subtítulo editorial */}
          <Link
            href="/painel"
            className="group flex shrink-0 flex-col rounded-[var(--rf-radius-xs)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[var(--rf-nav-text)] transition-colors group-hover:text-[var(--rf-nav-accent)]">
              ReadingFlow
            </span>
            <span className="font-serif text-[10px] italic tracking-wider text-[var(--rf-nav-accent-hover)]">
              Caderno & Acervo
            </span>
          </Link>

          {/* 2. CENTRO: Cápsula de navegação flutuante (desktop >= 1024px) */}
          <div className="hidden min-w-0 lg:flex lg:flex-1 lg:justify-center">
            <MastheadNav />
          </div>

          {/* 3. DIREITA: Busca rápida, botão + Novo Livro e Menu de Conta */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden xl:block w-48 2xl:w-60">
              <GlobalSearchBar />
            </div>

            {/* CTA Primário (+ Novo Livro) via componente compartilhado Button */}
            <Button
              href="/adicionar"
              variant="primary"
              size="sm"
              pill
              className="min-h-[44px] lg:min-h-[38px] shrink-0 px-3 sm:px-4 text-xs font-bold shadow-[var(--rf-nav-cta-shadow)]"
            >
              <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
              <span className="hidden sm:inline">Novo livro</span>
              <span className="sm:hidden">Novo</span>
            </Button>

            {/* Menu de Conta do Usuário */}
            <div ref={accountMenuRef} className="relative">
              <button
                ref={accountMenuBtnRef}
                type="button"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-label="Menu da conta"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface)] text-[var(--rf-nav-accent)] transition-colors hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
              >
                <User size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>

              {accountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-[var(--rf-radius-lg)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-elevated)] p-2 font-sans text-[var(--rf-nav-text)] shadow-[var(--rf-nav-popover-shadow)]"
                >
                  <div className="border-b border-[var(--rf-nav-border)] px-3 py-2">
                    <p className="font-sans text-[11px] font-semibold tracking-wider uppercase text-[var(--rf-nav-accent)]">
                      {profile.displayName || "Acervo Pessoal"}
                    </p>
                    <p className="truncate font-mono text-xs text-[var(--rf-nav-text-email)]">
                      {profile.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/configuracoes"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-[var(--rf-radius-md)] px-3 py-2 font-sans text-xs font-medium text-[var(--rf-nav-text)] transition-colors hover:bg-[var(--rf-nav-surface-hover)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                    >
                      <Settings
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      Configurações do acervo
                    </Link>
                  </div>

                  <div className="border-t border-[var(--rf-nav-border)] pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isSigningOut}
                      onClick={handleSignOut}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-[var(--rf-radius-md)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-danger)] transition-colors hover:bg-[var(--rf-nav-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-50"
                    >
                      <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
                      {isSigningOut ? "Encerrando..." : "Encerrar sessão"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Botão de menu móvel / tablet (< 1024px) */}
            <button
              ref={mobileMenuBtnRef}
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="menu-movel-masthead"
              aria-label={
                mobileMenuOpen
                  ? "Fechar menu de navegação"
                  : "Abrir menu de navegação"
              }
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--rf-radius-md)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface)] text-[var(--rf-nav-accent)] transition-colors hover:border-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:hidden"
            >
              {mobileMenuOpen ? (
                <X size={18} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Menu size={18} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Menu móvel e tablet desdobrável (< 1024px) */}
        {mobileMenuOpen ? (
          <nav
            id="menu-movel-masthead"
            aria-label="Navegação móvel e tablet"
            className="border-t border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] px-4 py-4 font-sans text-[var(--rf-text-heading)] shadow-[var(--rf-nav-mobile-shadow)] sm:px-6 lg:hidden"
          >
            <div className="mb-3">
              <GlobalSearchBar />
            </div>

            <p className="mb-2 font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--rf-text-accent-secondary)]">
              Navegação Principal
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {MASTHEAD_NAV_ITEMS.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex min-h-[44px] items-center justify-between rounded-[var(--rf-radius-md)] border px-3.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                        active
                          ? "border-[var(--rf-surface-contrast-hover)] bg-[var(--rf-surface-contrast-hover)] text-[var(--rf-text-on-contrast)]"
                          : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-mobile-item)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-mobile-item-hover)]"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span
                        aria-hidden="true"
                        className={
                          active
                            ? "text-[var(--rf-accent-primary)]"
                            : "text-[var(--rf-text-tertiary)]"
                        }
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-[var(--rf-border-subtle)] pt-3">
              <p className="mb-2 font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--rf-text-secondary)]">
                Atalhos do Acervo
              </p>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {MOBILE_EXTRA_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex min-h-[44px] items-center rounded-[var(--rf-radius-sm)] border px-3 font-sans text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                          active
                            ? "border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)]"
                            : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)]"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--rf-border-subtle)] pt-3 font-sans text-xs">
              <span className="truncate font-mono text-[11px] text-[var(--rf-text-secondary)]">
                {profile.email}
              </span>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-status-error)] bg-[var(--rf-surface-elevated)] px-3 py-1.5 font-sans text-xs font-semibold text-[var(--rf-status-error)] transition-colors hover:bg-[var(--rf-status-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
              >
                {isSigningOut ? "Saindo..." : "Encerrar sessão"}
              </button>
            </div>
          </nav>
        ) : null}
      </header>

      {/* ====================================================================
          ÁREA PRINCIPAL DE CONTEÚDO — FOLHA EDITORIAL CENTRAL (max-w-[1360px])
          Iluminação ambiente quente abaixo da navbar + folha sobre mesa
          ==================================================================== */}
      <div className="relative z-10 min-h-[calc(100dvh-4rem)]">
        <div
          aria-hidden="true"
          className="rf-top-ambient-glow pointer-events-none absolute inset-x-0 top-0 z-10 h-44"
        />
        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="rf-editorial-sheet relative z-10 min-h-[calc(100dvh-4rem)] min-w-0 px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-9 lg:pb-16"
        >
          <UndoBanner undoInfo={undoInfo} />
          {children}
        </main>
      </div>

      {/* Navegação inferior rápida para toque no celular e tablet (< 1024px) */}
      <nav
        aria-label="Acesso rápido móvel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rf-nav-border)] bg-[var(--rf-nav-bg)] px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] font-sans text-[var(--rf-nav-text)] lg:hidden"
      >
        <ul className="grid grid-cols-5 gap-1">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[48px] flex-col items-center justify-center rounded-[var(--rf-radius-md)] px-1 text-center font-sans text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                    active
                      ? "border border-[var(--rf-border-accent-soft)] bg-[var(--rf-nav-accent-subtle)] text-[var(--rf-nav-accent-hover)]"
                      : "text-[var(--rf-nav-text-muted)] hover:text-[var(--rf-nav-accent-hover)]"
                  }`}
                >
                  <span className="w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
