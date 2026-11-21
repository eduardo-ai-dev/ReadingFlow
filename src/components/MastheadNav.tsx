"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export const MASTHEAD_NAV_ITEMS = [
  { href: "/painel", label: "Mesa de Leitura" },
  { href: "/estante-3d", label: "Estante 3D" },
  { href: "/leitura/foco", label: "Canto de Foco" },
  { href: "/explorar", label: "Explorar" },
  { href: "/evolucao", label: "Evolução" },
] as const;

/** Atalhos complementares exibidos no menu móvel/tablet (< 1024px). */
export const MOBILE_EXTRA_ITEMS = [
  { href: "/estantes", label: "Estantes 2D" },
  { href: "/leitura", label: "Leitura & Fila" },
  { href: "/desejos", label: "Lista de Desejos" },
  { href: "/metas", label: "Metas" },
  { href: "/estatisticas", label: "Estatísticas" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

export function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (
    href === "/estante-3d" &&
    (pathname === "/estantes" ||
      pathname.startsWith("/livros/") ||
      pathname.startsWith("/generos/"))
  ) {
    return true;
  }
  if (href === "/leitura/foco" && pathname === "/leitura") {
    return true;
  }
  if (
    href === "/explorar" &&
    (pathname === "/adicionar" ||
      pathname === "/desejos" ||
      pathname === "/importar")
  ) {
    return true;
  }
  if (
    href === "/evolucao" &&
    (pathname === "/metas" || pathname === "/estatisticas")
  ) {
    return true;
  }
  return false;
}

/**
 * Navegação em cápsula flutuante do masthead editorial (Desktop >= 1024px).
 * Sem quebra de linha nem estouro horizontal.
 */
export function MastheadNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu principal"
      className="flex max-w-full items-center gap-0.5 xl:gap-1 rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface)] p-1 font-sans"
    >
      {MASTHEAD_NAV_ITEMS.map(({ href, label }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 whitespace-nowrap rounded-[var(--rf-radius-full)] px-3 xl:px-3.5 py-1.5 font-sans text-xs xl:text-[13px] font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
              active
                ? "bg-[var(--rf-accent-primary)] text-[var(--rf-accent-on-primary)]"
                : "text-[var(--rf-nav-text-muted)] hover:text-[var(--rf-nav-accent-hover)]"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="nav-pill"
                aria-hidden="true"
                className="absolute inset-0 rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] shadow-[var(--rf-nav-pill-glow)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

