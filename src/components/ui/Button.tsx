import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Piloto 1 — Button (100% baseado em tokens semânticos `--rf-*`):
 * - primary: Destaque primário (`--rf-accent-primary`) com texto `--rf-accent-on-primary`
 * - secondary: Destaque secundário (`--rf-accent-secondary`) sólido ou vazado (`secondaryStyle="outline"`)
 * - subtle: Ação discreta auxiliar
 */
export type RfButtonVariant = "primary" | "secondary" | "subtle";
export type RfButtonSize = "sm" | "md" | "lg";
export type RfControlTone = "light" | "dark";

export interface RfButtonStyleOptions {
  variant?: RfButtonVariant;
  secondaryStyle?: "solid" | "outline";
  tone?: RfControlTone;
  size?: RfButtonSize;
  pill?: boolean;
  className?: string;
}

export function rfButtonClassName({
  variant = "primary",
  secondaryStyle = "solid",
  tone = "light",
  size = "md",
  pill = false,
  className = "",
}: RfButtonStyleOptions = {}): string {
  const sizeClass =
    size === "sm"
      ? "min-h-[var(--rf-control-h-sm)] px-[var(--rf-control-px-sm)] py-1.5 text-[13px]"
      : size === "lg"
        ? "min-h-[var(--rf-control-h-lg)] px-[var(--rf-control-px-lg)] py-2.5 text-[14px]"
        : "min-h-[var(--rf-control-h-md)] px-[var(--rf-control-px-md)] py-2 text-[13px]";

  const shapeClass = pill
    ? "rounded-[var(--rf-radius-full)]"
    : "rounded-[var(--rf-radius-md)]";

  const base =
    "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-sans font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:cursor-not-allowed disabled:opacity-55";

  let colorClass = "";

  if (variant === "primary") {
    colorClass =
      "border border-[var(--rf-accent-primary)] bg-[var(--rf-accent-primary)] text-[var(--rf-accent-on-primary)] hover:border-[var(--rf-accent-primary-hover)] hover:bg-[var(--rf-accent-primary-hover)]";
  } else if (variant === "secondary") {
    if (tone === "dark") {
      colorClass =
        secondaryStyle === "outline"
          ? "border-[1.5px] border-[var(--rf-border-accent)] bg-transparent text-[var(--rf-text-on-contrast-muted)] hover:bg-[var(--rf-accent-primary-subtle)] hover:text-[var(--rf-text-on-contrast)]"
          : "border border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-on-dark-hover)]";
    } else {
      colorClass =
        secondaryStyle === "outline"
          ? "border border-[var(--rf-border-secondary)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-accent-secondary)] hover:border-[var(--rf-accent-secondary)] hover:bg-[var(--rf-accent-secondary-subtle)]"
          : "border border-[var(--rf-accent-secondary)] bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-hover)]";
    }
  } else {
    // subtle (discreta)
    colorClass =
      tone === "dark"
        ? "border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] text-[var(--rf-text-on-contrast)] hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-contrast-hover)]"
        : "rf-icon-btn border border-transparent bg-transparent text-[var(--rf-text-accent-secondary)] hover:bg-[var(--rf-surface-subtle)] hover:text-[var(--rf-text-primary)]";
  }

  return `${base} ${sizeClass} ${shapeClass} ${colorClass} ${className}`.trim();
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">,
    RfButtonStyleOptions {
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  secondaryStyle = "solid",
  tone = "light",
  size = "md",
  pill = false,
  className = "",
  href,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const cls = rfButtonClassName({
    variant,
    secondaryStyle,
    tone,
    size,
    pill,
    className,
  });

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
