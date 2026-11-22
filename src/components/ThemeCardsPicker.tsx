"use client";

import { Check, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { THEME_LIST } from "@/lib/themes/themes.config";
import type { ThemeId } from "@/lib/themes/themes.types";

/**
 * Seletor mínimo de temas (Fase 3):
 * 4 cards com prévia visual (fundo, superfície, texto e destaque) + opção "Automático (Caderno ↔ Dark Academia)".
 * Troca o tema ao vivo via `useTheme()` sem recarregar e sem flash. Sem opções avançadas (Fase 5).
 */
export function ThemeCardsPicker({
  onSelect,
}: {
  onSelect?: (next: "system" | ThemeId) => void;
}) {
  const { themePreference, resolvedTheme, setTheme } = useTheme();
  const isAuto = themePreference === "system";

  const handleChoose = (next: "system" | ThemeId) => {
    setTheme(next);
    onSelect?.(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-sans text-xs font-semibold text-[var(--rf-text-primary)]">
            Tema da Biblioteca
          </p>
          <p className="font-sans text-[12px] text-[var(--rf-text-secondary)]">
            Aplica imediatamente em todo o ReadingFlow sem recarregar.
          </p>
        </div>

        <button
          type="button"
          aria-pressed={isAuto}
          onClick={() => handleChoose("system")}
          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[var(--rf-radius-full)] border px-3 py-1 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-[36px] ${
            isAuto
              ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary)] text-[var(--rf-accent-on-primary)]"
              : "border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)]"
          }`}
        >
          <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Automático (Caderno ↔ Dark Academia)</span>
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Escolher tema curado"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {THEME_LIST.map((theme) => {
          const isSelected = !isAuto && resolvedTheme === theme.id;
          const isAutoActive = isAuto && resolvedTheme === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-theme-card={theme.id}
              onClick={() => handleChoose(theme.id)}
              className={`group flex cursor-pointer flex-col overflow-hidden rounded-[var(--rf-card-radius)] border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                isSelected
                  ? "border-[var(--rf-border-accent)] bg-[var(--rf-surface-card-solid)] ring-2 ring-[var(--rf-border-accent)]"
                  : "border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] hover:border-[var(--rf-border-accent)]"
              }`}
            >
              {/* Prévia visual (fundo, superfície, texto e destaque) */}
              <div
                aria-hidden="true"
                className="relative flex h-20 w-full flex-col justify-between p-3"
                style={{ backgroundColor: theme.preview.background }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="h-2.5 w-16 rounded-full"
                    style={{ backgroundColor: theme.preview.text }}
                  />
                  <span className="flex items-center gap-1">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-current/20"
                      style={{
                        backgroundColor: theme.preview.accent,
                        color: theme.preview.text,
                      }}
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-current/20"
                      style={{
                        backgroundColor: theme.preview.accentSecondary,
                        color: theme.preview.text,
                      }}
                    />
                  </span>
                </div>

                <div
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5"
                  style={{ backgroundColor: theme.preview.surface }}
                >
                  <div className="space-y-1">
                    <span
                      className="block h-1.5 w-14 rounded-full opacity-90"
                      style={{ backgroundColor: theme.preview.text }}
                    />
                    <span
                      className="block h-1.5 w-9 rounded-full opacity-55"
                      style={{ backgroundColor: theme.preview.text }}
                    />
                  </div>
                  <span
                    className="h-4 w-10 rounded-full"
                    style={{ backgroundColor: theme.preview.accent }}
                  />
                </div>
              </div>

              {/* Rótulo do card */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--rf-divider)] px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate font-sans text-xs font-bold text-[var(--rf-text-heading)]">
                    {theme.name}
                  </span>
                  <span className="block truncate font-sans text-[11px] text-[var(--rf-text-secondary)]">
                    {theme.colorScheme === "dark" ? "Escuro" : "Claro"}
                    {isAutoActive ? " · ativo (auto)" : ""}
                  </span>
                </div>

                {isSelected ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] text-[var(--rf-accent-on-primary)]">
                    <Check
                      className="h-3 w-3"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
