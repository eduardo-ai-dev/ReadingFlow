"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Gatilho compacto de busca do masthead (Ctrl+K ou "/" para focar). */
export function GlobalSearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "/" && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      <label htmlFor="global-search-input" className="sr-only">
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
        id="global-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar no acervo..."
        className="min-h-[40px] w-full rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border-accent)] bg-[var(--rf-nav-surface)] pl-9 pr-16 text-[13px] text-[var(--rf-nav-text)] placeholder:text-[var(--rf-nav-text-subtle)] transition-colors hover:border-[var(--rf-nav-border-accent-hover)] focus:border-[var(--rf-nav-accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-nav-accent-ring)]"
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
