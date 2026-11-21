"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * Exibe o rótulo explícito da base temporal de uma métrica (ex.: "média nos dias ativos",
 * "média do ano") acompanhado de tooltip nativo e expansão acessível ao clique/teclado
 * com a fórmula exata do cálculo.
 */
export function MetricFormulaHint({
  basisLabel,
  formula,
  tone = "light",
  className = "",
}: {
  basisLabel: string;
  formula: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();

  const triggerColor =
    tone === "dark"
      ? "text-[var(--rf-text-on-contrast-muted)] hover:text-[var(--rf-text-on-contrast)]"
      : "text-[var(--rf-text-secondary)] hover:text-[var(--rf-text-accent-secondary)]";

  const noteStyle =
    tone === "dark"
      ? "border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] text-[var(--rf-text-on-contrast)]"
      : "border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]";

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={formula}
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        aria-label={`${basisLabel}. ${formula}`}
        className={`rf-icon-btn inline-flex cursor-pointer items-center gap-1 rounded-[var(--rf-radius-xs)] text-left font-sans text-[13px] font-medium leading-snug underline decoration-dotted underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${triggerColor}`}
      >
        <span>{basisLabel}</span>
        <Info className="h-3.5 w-3.5 shrink-0 opacity-85" aria-hidden="true" />
      </button>

      {open ? (
        <span
          id={noteId}
          role="note"
          className={`mt-1.5 block max-w-full rounded-[var(--rf-radius-sm)] border px-2.5 py-1.5 font-sans text-[13px] leading-relaxed ${noteStyle}`}
        >
          {formula}
        </span>
      ) : null}
    </span>
  );
}
