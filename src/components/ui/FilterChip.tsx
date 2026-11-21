import Link from "next/link";
import type { ReactNode } from "react";
import type { RfControlTone } from "./Button";

/**
 * Piloto 3 — FilterChip (100% baseado em tokens semânticos `--rf-*`):
 * Chip único (ativo/inativo) aplicado no painel, na estante e no seletor de tema.
 */
export function filterChipClassName({
  active,
  tone = "light",
  className = "",
}: {
  active: boolean;
  tone?: RfControlTone;
  className?: string;
}): string {
  const base =
    "inline-flex min-h-[var(--rf-control-h-sm)] shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--rf-radius-full)] border px-[var(--rf-chip-px)] py-[var(--rf-chip-py)] font-sans text-[13px] font-semibold leading-none tabular-nums [font-variant-numeric:lining-nums_tabular-nums] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]";

  const colorClass =
    tone === "dark"
      ? active
        ? "border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary)] text-[var(--rf-accent-on-primary)]"
        : "border-[var(--rf-border-accent-soft)] bg-transparent text-[var(--rf-text-on-contrast)] hover:border-[var(--rf-accent-primary-hover)] hover:text-[var(--rf-text-on-contrast-muted)]"
      : active
        ? "border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)]"
        : "border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-subtle)]";

  return `${base} ${colorClass} ${className}`.trim();
}

export interface FilterChipProps {
  label?: string;
  count?: number;
  active: boolean;
  tone?: RfControlTone;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  role?: "tab";
  id?: string;
  tabIndex?: number;
  ariaControls?: string;
  ariaCurrent?: "page";
  scroll?: boolean;
  replace?: boolean;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  className?: string;
  children?: ReactNode;
}

export function FilterChip({
  label,
  count,
  active,
  tone = "light",
  href,
  onClick,
  onKeyDown,
  role,
  id,
  tabIndex,
  ariaControls,
  ariaCurrent,
  scroll,
  replace,
  buttonRef,
  className = "",
  children,
}: FilterChipProps) {
  const cls = filterChipClassName({ active, tone, className });
  const content = children ?? (
    <>
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          className={`font-bold ${
            tone === "dark"
              ? active
                ? "text-[var(--rf-accent-on-primary-muted)]"
                : "text-[var(--rf-text-on-contrast-muted)]"
              : active
                ? "text-[var(--rf-accent-on-secondary-muted)]"
                : "text-[var(--rf-text-secondary)]"
          }`}
        >
          ({count})
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        scroll={scroll}
        replace={replace}
        aria-current={ariaCurrent}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
        className={cls}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      aria-pressed={role === "tab" ? undefined : active}
      aria-controls={ariaControls}
      tabIndex={tabIndex}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      onKeyDown={onKeyDown}
      className={cls}
    >
      {content}
    </button>
  );
}
