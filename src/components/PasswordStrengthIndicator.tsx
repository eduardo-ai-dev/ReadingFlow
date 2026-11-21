"use client";

import { CheckCircle2 } from "lucide-react";
import { evaluatePasswordStrength } from "@/features/auth/rules";

export function PasswordStrengthIndicator({
  password,
}: {
  password: string;
}) {
  const evaluation = evaluatePasswordStrength(password);

  return (
    <div
      className="mt-2 rounded-[8px] border border-[#2C221E]/12 bg-[#F4EFE6]/60 px-3 py-2.5 font-sans"
      aria-live="polite"
    >
      {/* 1. Barra de Nível de Senha (4 segmentos) + Rótulo alinhado à direita */}
      <div className="flex items-center justify-between gap-3">
        <div
          role="meter"
          aria-label="Força da senha"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={evaluation.segments}
          aria-valuetext={evaluation.label}
          className="grid flex-1 grid-cols-4 gap-1.5"
        >
          {([1, 2, 3, 4] as const).map((segmentIndex) => {
            const active = evaluation.segments >= segmentIndex;
            return (
              <span
                key={segmentIndex}
                style={{
                  backgroundColor: active
                    ? evaluation.colorHex
                    : "rgba(44, 34, 30, 0.14)",
                }}
                className="h-1.5 rounded-full transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
            );
          })}
        </div>

        <span
          style={{
            color:
              evaluation.level === "empty"
                ? "rgba(44, 34, 30, 0.65)"
                : evaluation.colorHex,
          }}
          className="min-w-[68px] text-right font-sans text-xs font-semibold tracking-tight transition-colors duration-200"
        >
          {evaluation.label}
        </span>
      </div>

      {/* 2. Checklist Compacto de Requisitos (Grid de 2 colunas) */}
      <ul
        aria-label="Requisitos obrigatórios da senha"
        className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 font-sans text-xs sm:grid-cols-2"
      >
        {evaluation.criteria.map((criterion) => (
          <li
            key={criterion.key}
            className={`flex items-center gap-1.5 transition-colors duration-200 ${
              criterion.met ? "font-medium text-[#141514]" : "text-[#2C221E]/65"
            }`}
          >
            <CheckCircle2
              className={`h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${
                criterion.met ? "text-[#3B523E]" : "text-[#2C221E]/45"
              }`}
              aria-hidden="true"
            />
            <span className="truncate">{criterion.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
