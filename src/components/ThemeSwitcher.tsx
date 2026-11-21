"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Card } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import {
  DENSITY_OPTIONS,
  MOTION_OPTIONS,
  THEME_LIST,
} from "@/lib/themes/themes.config";

export function ThemeSwitcher({
  showAdvancedControls = true,
}: {
  showAdvancedControls?: boolean;
}) {
  const {
    themePreference,
    resolvedTheme,
    density,
    motion,
    setTheme,
    setDensity,
    setMotion,
  } = useTheme();

  return (
    <Card
      as="section"
      aria-label="Seletor de tema, densidade e movimento"
      variant="elevated"
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rf-divider)] pb-3">
        <div>
          <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
            Controle de Tema em Tempo Real
          </p>
          <h2 className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]">
            Preferências de Aparência
          </h2>
        </div>
        <span
          data-testid="active-theme-badge"
          className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-3 py-1 font-mono text-xs font-semibold text-[var(--rf-text-primary)]"
        >
          ativo: {resolvedTheme}
          {themePreference === "system" ? " (auto)" : ""}
        </span>
      </div>

      {/* Seleção de Tema */}
      <div className="space-y-2">
        <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
          Tema
        </p>
        <div
          role="group"
          aria-label="Escolher tema"
          className="flex flex-wrap gap-2"
        >
          <FilterChip
            active={themePreference === "system"}
            onClick={() => setTheme("system")}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Automático (Sistema)</span>
          </FilterChip>

          {THEME_LIST.map((item) => {
            const isSelected =
              themePreference !== "system" && resolvedTheme === item.id;

            return (
              <FilterChip
                key={item.id}
                active={isSelected}
                onClick={() => setTheme(item.id)}
              >
                {item.colorScheme === "dark" ? (
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{item.name}</span>
              </FilterChip>
            );
          })}
        </div>
      </div>

      {showAdvancedControls ? (
        <div className="grid gap-4 border-t border-[var(--rf-divider)] pt-4 sm:grid-cols-2">
          {/* Densidade */}
          <div className="space-y-2">
            <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
              Densidade (`data-density`)
            </p>
            <div
              role="group"
              aria-label="Escolher densidade"
              className="flex flex-wrap gap-2"
            >
              {DENSITY_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={density === opt.id}
                  onClick={() => setDensity(opt.id)}
                />
              ))}
            </div>
          </div>

          {/* Movimento */}
          <div className="space-y-2">
            <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
              Movimento (`data-motion`)
            </p>
            <div
              role="group"
              aria-label="Escolher preferência de movimento"
              className="flex flex-wrap gap-2"
            >
              {MOTION_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={motion === opt.id}
                  onClick={() => setMotion(opt.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
