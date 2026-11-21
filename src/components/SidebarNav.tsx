"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Library,
  BookPlus,
  BookOpen,
  BookmarkCheck,
  Target,
  BarChart3,
  Settings,
} from "lucide-react";

export const SIDEBAR_NAV_ITEMS = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/estantes", label: "Estantes", icon: Library },
  { href: "/adicionar", label: "Adicionar", icon: BookPlus },
  { href: "/leitura", label: "Leitura", icon: BookOpen },
  { href: "/desejos", label: "Desejos", icon: BookmarkCheck },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function SidebarNav({ onSelect }: { onSelect?: () => void }) {
  const path = usePathname();

  const isActive = (href: string) =>
    path === href ||
    (href === "/estantes" &&
      (path.startsWith("/livros/") || path.startsWith("/generos/")));

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {SIDEBAR_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onSelect}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-[var(--rf-radius-lg)] px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
              active
                ? "text-[var(--rf-nav-text)]"
                : "text-[var(--rf-nav-text-subtle)] hover:text-[var(--rf-nav-accent-soft)]"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-[var(--rf-radius-lg)] border border-[var(--rf-nav-border-accent-hover)] bg-[var(--rf-nav-accent-subtle)] shadow-[var(--rf-cursor-ring-glow)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon
              className={`relative z-10 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                active
                  ? "text-[var(--rf-nav-accent-soft)]"
                  : "text-[var(--rf-nav-text-subtle)] group-hover:text-[var(--rf-nav-accent-soft)]"
              }`}
              strokeWidth={1.5}
            />
            <span className="relative z-10 tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

