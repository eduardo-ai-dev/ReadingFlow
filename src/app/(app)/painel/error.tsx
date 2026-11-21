"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="rf-dashboard-shell py-8">
      <section className="rf-card mx-auto max-w-xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]"
        >
          <AlertCircle className="h-5 w-5" />
        </div>
        <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">Mesa de Leitura</p>
        <h1 className="rf-type-section-title mt-1">
          Não foi possível carregar seu painel
        </h1>
        <p className="rf-type-body mt-2 text-[var(--rf-text-secondary)]">
          Ocorreu uma falha temporária ao reunir os indicadores do seu acervo.
          Seus livros e registros continuam intactos.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className={rfButtonClassName({
              variant: "primary",
              size: "lg",
            })}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Tentar novamente</span>
          </button>

          <Link
            href="/estantes"
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "lg",
            })}
          >
            Ir para Estantes
          </Link>
        </div>
      </section>
    </div>
  );
}
