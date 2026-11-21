"use client";

import { formatRatingPtBr } from "@/lib/formatters";
export { formatRatingPtBr };

const HALF_STAR_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function StarRatingDisplay({
  rating,
  labelPrefix = "Nota",
  variant = "default",
}: {
  rating: number;
  labelPrefix?: string;
  variant?: "default" | "navy" | "gold";
}) {
  const formatted = formatRatingPtBr(rating);

  if (variant === "gold" || variant === "navy") {
    return (
      <span
        aria-label={`${labelPrefix}: ${formatted} de 5 estrelas`}
        className="inline-flex items-center gap-1 rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] px-2.5 py-0.5 text-xs font-bold text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-xs)]"
      >
        <span aria-hidden="true" className="text-[var(--rf-text-on-contrast-muted)]">
          ★
        </span>
        <span>{formatted}</span>
      </span>
    );
  }

  return (
    <span
      aria-label={`${labelPrefix}: ${formatted} de 5 estrelas`}
      className="inline-flex items-center gap-1 rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] px-2.5 py-0.5 text-xs font-semibold text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-xs)]"
    >
      <span aria-hidden="true" className="text-[var(--rf-text-accent-secondary)]">
        ★
      </span>
      <span>{formatted}</span>
    </span>
  );
}

export function StarRatingInput({
  id,
  label,
  value,
  onChange,
  allowClear = false,
}: {
  id: string;
  label: string;
  value?: number;
  onChange: (next: number | undefined) => void;
  allowClear?: boolean;
}) {
  return (
    <fieldset id={id} className="space-y-2">
      <legend className="text-sm font-medium text-[var(--rf-text-primary)]">
        {label}{" "}
        {value ? (
          <span className="font-semibold text-[var(--rf-text-heading)]">
            ({formatRatingPtBr(value)} ★)
          </span>
        ) : (
          <span className="text-[var(--rf-text-secondary)]">(Sem nota)</span>
        )}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {HALF_STAR_STEPS.map((step) => {
          const selected = value === step;
          const labelPt = formatRatingPtBr(step);
          return (
            <button
              key={step}
              type="button"
              aria-pressed={selected}
              aria-label={`${labelPt} estrelas`}
              onClick={() => onChange(step)}
              className={`min-h-[40px] min-w-[44px] rounded-[var(--rf-radius-sm)] border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                selected
                  ? "border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)]"
                  : "border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-primary)] hover:bg-[var(--rf-surface-subtle)]"
              }`}
            >
              {labelPt}
            </button>
          );
        })}
        {allowClear && value !== undefined ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="min-h-[40px] rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-subtle)] px-3 text-xs text-[var(--rf-text-secondary)] hover:bg-[var(--rf-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Limpar
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
