"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface MarketingSessionState {
  authenticated: boolean;
  displayName: string | null;
}

const VISITOR_STATE: MarketingSessionState = {
  authenticated: false,
  displayName: null,
};

let cachedSessionPromise: Promise<MarketingSessionState> | null = null;

function fetchMarketingSession(): Promise<MarketingSessionState> {
  if (!cachedSessionPromise) {
    cachedSessionPromise = fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return VISITOR_STATE;
        const data = (await res.json()) as Partial<MarketingSessionState>;
        return {
          authenticated: Boolean(data.authenticated),
          displayName:
            typeof data.displayName === "string" && data.displayName.trim()
              ? data.displayName.trim()
              : null,
        };
      })
      .catch(() => VISITOR_STATE);
  }
  return cachedSessionPromise;
}

export function resetMarketingSessionCacheForTests(): void {
  cachedSessionPromise = null;
}

export function useMarketingSession(): MarketingSessionState {
  // Começa sempre no estado visitante para SSR/hidratação 100% estáveis
  const [session, setSession] = useState<MarketingSessionState>(VISITOR_STATE);

  useEffect(() => {
    let active = true;
    void fetchMarketingSession().then((resolved) => {
      if (active && resolved.authenticated) {
        setSession(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return session;
}

function getInitials(name: string | null): string {
  if (!name) return "RF";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RF";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function MarketingSessionActions({
  session,
}: {
  session: MarketingSessionState;
}) {
  const initials = getInitials(session.displayName);

  return (
    <nav
      aria-label="Acesso à biblioteca"
      data-session-state={session.authenticated ? "authenticated" : "visitor"}
      className="flex min-w-[186px] items-center justify-end gap-1.5 sm:min-w-[238px] sm:gap-3"
    >
      {session.authenticated ? (
        <>
          <Link
            href="/estante-3d"
            aria-label="Abrir Minha Estante"
            className="inline-flex min-h-[36px] shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--rf-radius-full)] border border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary)] px-3 sm:px-4 font-sans text-xs sm:text-sm font-semibold tracking-[0.01em] text-[var(--rf-accent-on-primary)] shadow-[var(--rf-nav-cta-shadow)] transition-colors hover:border-[var(--rf-accent-primary-hover)] hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Minha Estante
          </Link>
          <Link
            href="/painel"
            aria-label={
              session.displayName
                ? `Conta de ${session.displayName}`
                : "Minha conta no ReadingFlow"
            }
            title={session.displayName ?? "Minha conta"}
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border-accent-strong)] bg-[var(--rf-nav-surface-alt)] font-sans text-xs font-bold tracking-tight text-[var(--rf-nav-text)] transition-colors hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            {initials}
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/entrar"
            aria-label="Entrar na sua conta"
            className="inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-[var(--rf-radius-full)] px-2 sm:px-3 font-sans text-xs sm:text-sm font-medium text-[var(--rf-nav-text-marketing)] underline-offset-4 transition-colors hover:text-[var(--rf-nav-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Entrar
          </Link>
          <Link
            href="/criar-conta"
            aria-label="Criar minha estante"
            className="inline-flex min-h-[36px] shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--rf-radius-full)] border border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary)] px-2.5 sm:px-4 font-sans text-xs sm:text-sm font-semibold tracking-[0.01em] text-[var(--rf-accent-on-primary)] shadow-[var(--rf-nav-cta-shadow)] transition-colors hover:border-[var(--rf-accent-primary-hover)] hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Criar minha estante
          </Link>
        </>
      )}
    </nav>
  );
}

export function MarketingMobileSessionActions({
  session,
  onNavigate,
}: {
  session: MarketingSessionState;
  onNavigate: () => void;
}) {
  const initials = getInitials(session.displayName);

  if (session.authenticated) {
    return (
      <div className="space-y-1.5 pb-1">
        <Link
          href="/estante-3d"
          role="menuitem"
          onClick={onNavigate}
          className="flex min-h-[38px] w-full items-center justify-center rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] px-3 font-sans text-xs font-semibold text-[var(--rf-accent-on-primary)] transition-colors hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          Minha Estante
        </Link>
        <Link
          href="/painel"
          role="menuitem"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-[var(--rf-radius-sm)] px-3 py-2 font-sans text-xs font-semibold text-[var(--rf-nav-text)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-nav-border-accent-strong)] bg-[var(--rf-nav-surface-alt)] text-[10px] font-bold text-[var(--rf-nav-text)]"
          >
            {initials}
          </span>
          <span className="truncate">
            {session.displayName ?? "Minha conta"}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pb-1">
      <Link
        href="/criar-conta"
        role="menuitem"
        onClick={onNavigate}
        className="flex min-h-[38px] w-full items-center justify-center rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] px-3 font-sans text-xs font-semibold text-[var(--rf-accent-on-primary)] transition-colors hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
      >
        Criar minha estante
      </Link>
      <Link
        href="/entrar"
        role="menuitem"
        onClick={onNavigate}
        className="block rounded-[var(--rf-radius-sm)] px-3 py-2 text-center font-sans text-xs font-semibold text-[var(--rf-nav-text-marketing)] hover:bg-[var(--rf-nav-surface-alt)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
      >
        Entrar
      </Link>
    </div>
  );
}
