"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export function DashboardBlockError({
  eyebrow,
  title,
  message = "Não foi possível carregar este bloco agora. Tente recarregar o painel.",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  message?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <section
      role="alert"
      aria-label={`Erro em ${title}`}
      className={`rf-card flex flex-col justify-between gap-4 ${className}`}
    >
      <div className="border-b border-[var(--rf-divider)] pb-3">
        {eyebrow ? (
          <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="rf-type-section-title mt-0.5">{title}</h2>
      </div>

      <div className="flex items-start gap-2.5 py-2">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rf-status-error)]"
          aria-hidden="true"
        />
        <p className="rf-type-body text-[var(--rf-text-secondary)]">{message}</p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => router.refresh()}
          aria-label={`Tentar carregar ${title} novamente`}
          className={rfButtonClassName({
            variant: "secondary",
            secondaryStyle: "outline",
            size: "sm",
          })}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    </section>
  );
}

export function DashboardBlockEmpty({
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  compact = false,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "py-3" : "py-6 text-center"}>
      <p className="font-serif text-base font-semibold text-[var(--rf-text-heading)]">
        {title}
      </p>
      <p
        className={`rf-type-caption mt-1 text-[var(--rf-text-secondary)] ${
          compact ? "" : "mx-auto max-w-md"
        }`}
      >
        {description}
      </p>
      {actionLabel && actionHref ? (
        <div
          className={`mt-3.5 flex flex-wrap items-center gap-2.5 ${
            compact ? "" : "justify-center"
          }`}
        >
          <Link
            href={actionHref}
            className={rfButtonClassName({
              variant: "secondary",
              size: "sm",
            })}
          >
            {actionLabel}
          </Link>
          {secondaryLabel && secondaryHref ? (
            <Link
              href={secondaryHref}
              className={rfButtonClassName({
                variant: "secondary",
                secondaryStyle: "outline",
                size: "sm",
              })}
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
