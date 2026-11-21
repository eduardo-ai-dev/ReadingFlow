import type { HTMLAttributes, ReactNode } from "react";

/**
 * Piloto 2 — Card (100% baseado em tokens semânticos `--rf-*`):
 * - default: superfície editorial translúcida (`--rf-surface-card`) + borda `--rf-border-subtle`
 * - elevated: superfície elevada sólida (`--rf-surface-elevated`) + sombra `--rf-shadow-lg`
 * - subtle: superfície sutil (`--rf-surface-subtle`)
 * - spotlight: bloco escuro de alto contraste (`--rf-surface-contrast` + `--rf-text-on-contrast`)
 */
export type RfCardVariant = "default" | "elevated" | "subtle" | "spotlight";
export type RfCardPadding = "none" | "sm" | "md";

export function rfCardClassName({
  variant = "default",
  padding = "md",
  className = "",
}: {
  variant?: RfCardVariant;
  padding?: RfCardPadding;
  className?: string;
} = {}): string {
  const paddingClass =
    padding === "none"
      ? "p-0"
      : padding === "sm"
        ? "p-[var(--rf-card-padding-sm)]"
        : "p-[var(--rf-card-padding-sm)] sm:p-[var(--rf-card-padding)]";

  const base =
    "min-w-0 rounded-[var(--rf-card-radius)] border transition-colors";

  let surfaceClass = "";
  if (variant === "spotlight") {
    surfaceClass =
      "relative overflow-hidden border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-spotlight)]";
  } else if (variant === "elevated") {
    surfaceClass =
      "border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-lg)]";
  } else if (variant === "subtle") {
    surfaceClass =
      "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-none)]";
  } else {
    surfaceClass =
      "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-card)] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-card)]";
  }

  return `${base} ${paddingClass} ${surfaceClass} ${className}`.trim();
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  variant?: RfCardVariant;
  padding?: RfCardPadding;
  children: ReactNode;
}

export function Card({
  as = "div",
  variant = "default",
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  const cls = rfCardClassName({ variant, padding, className });

  if (as === "section") {
    return (
      <section className={cls} {...rest}>
        {children}
      </section>
    );
  }
  if (as === "article") {
    return (
      <article className={cls} {...rest}>
        {children}
      </article>
    );
  }
  if (as === "aside") {
    return (
      <aside className={cls} {...rest}>
        {children}
      </aside>
    );
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
