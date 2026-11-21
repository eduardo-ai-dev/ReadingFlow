"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function isSearchInputVisible(el: HTMLElement | null): boolean {
  if (!el || !el.isConnected) return false;
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    node = node.parentElement;
  }
  return true;
}

/** Gatilho compacto de busca do masthead (Ctrl+K ou "/" para focar). */
export function GlobalSearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !isInput;
      if (!isCtrlK && !isSlash) return;

      const currentInput = inputRef.current;
      if (currentInput && isSearchInputVisible(currentInput)) {
        e.preventDefault();
        currentInput.focus();
        currentInput.select();
        return;
      }

      // Se outro campo de busca global estiver visível (ex.: menu móvel aberto ou /explorar), deixa ele assumir.
      const allSearchInputs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-rf-global-search-input="true"]'
        )
      );
      if (allSearchInputs.some((node) => isSearchInputVisible(node))) {
        return;
      }

      // Em larguras menores (ex.: 1024px/390px) onde o campo do cabeçalho está oculto,
      // redireciona Ctrl+K para a busca global em /explorar?buscar=1 (evitando duplicar chamadas).
      if (
        isCtrlK &&
        pathname !== "/explorar" &&
        currentInput &&
        allSearchInputs[0] === currentInput
      ) {
        e.preventDefault();
        router.push("/explorar?buscar=1");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/estantes");
      return;
    }
    router.push(`/estantes?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={`group relative flex items-center ${className}`}
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar por título, autor, ISBN ou gênero
      </label>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-3 flex items-center text-[var(--rf-nav-accent-soft)]"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        data-rf-global-search-input="true"
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar no acervo..."
        className="min-h-[44px] lg:min-h-[40px] w-full rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border-accent)] bg-[var(--rf-nav-surface)] pl-9 pr-16 text-base lg:text-[13px] text-[var(--rf-nav-text)] placeholder:text-[var(--rf-nav-text-subtle)] transition-colors hover:border-[var(--rf-nav-border-accent-hover)] focus:border-[var(--rf-nav-accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-nav-accent-ring)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 flex items-center"
      >
        <kbd className="rounded-[var(--rf-radius-xs)] border border-[var(--rf-nav-accent-ring)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--rf-nav-accent-soft)]">
          Ctrl K
        </kbd>
      </div>
    </form>
  );
}
