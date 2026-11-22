"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export default function StatisticsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="py-8">
      <section className="rf-card mx-auto max-w-xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]"
        >
          <AlertCircle className="h-5 w-5" />
        </div>
        <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
          Análises e Ranking
        </p>
        <h1 className="rf-type-section-title mt-1">
          Não foi possível carregar suas estatísticas
        </h1>
        <p className="rf-type-body mt-2 text-[var(--rf-text-secondary)]">
          Ocorreu uma falha temporária ao calcular os indicadores e o ranking do
          seu acervo. Seus livros e avaliações continuam salvos com segurança.
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
            href="/painel"
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "lg",
            })}
          >
            Voltar ao Painel
          </Link>
        </div>
      </section>
    </div>
  );
}
