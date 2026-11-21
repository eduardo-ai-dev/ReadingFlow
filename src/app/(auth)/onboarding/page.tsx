"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/features/auth/actions";
import type { ShelfKind } from "@/lib/domain";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<"organize" | "read_more" | "track_formats">(
    "organize"
  );
  const [formats, setFormats] = useState<ShelfKind[]>([
    "physical",
    "digital",
    "audio",
  ]);
  const [annualTarget, setAnnualTarget] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleFormat = (kind: ShelfKind) => {
    setFormats((prev) =>
      prev.includes(kind)
        ? prev.length > 1
          ? prev.filter((k) => k !== kind)
          : prev
        : [...prev, kind]
    );
  };

  const finishOnboarding = (nextRoute: "/adicionar" | "/painel") => {
    setError(null);
    startTransition(async () => {
      const parsedTarget = Number.parseInt(annualTarget, 10);
      const res = await completeOnboardingAction({
        goal,
        preferredFormats: formats,
        annualTargetBooks:
          Number.isFinite(parsedTarget) && parsedTarget > 0
            ? parsedTarget
            : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(nextRoute);
      router.refresh();
    });
  };

  return (
    <div className="rf-stagger-1 rounded-[14px] border border-[#2C221E]/15 bg-[#FAF6F0] p-6 text-[#141514] shadow-[0_20px_50px_rgba(44,34,30,0.08)] sm:p-8">
      <p className="editorial-kicker !text-[#722F3E]">Passo {step} de 3</p>
      <h1 className="mt-1.5 font-serif text-2xl font-semibold text-[#141514]">
        {step === 1 && "Qual seu foco principal hoje?"}
        {step === 2 && "Quais formatos você costuma ler?"}
        {step === 3 && "Quer definir uma meta anual leve?"}
      </h1>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-[8px] border border-[#9E2A2B] bg-[#9E2A2B]/10 p-3 text-xs font-medium text-[#9E2A2B]"
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-5 space-y-2.5">
          {(
            [
              ["organize", "Catalogar os livros que já tenho em casa"],
              ["read_more", "Acompanhar ritmo e concluir mais leituras"],
              ["track_formats", "Reunir impressos, e-books e audiobooks"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              aria-pressed={goal === val}
              onClick={() => setGoal(val)}
              className={`flex min-h-[48px] w-full cursor-pointer items-center rounded-[8px] border px-4 text-left text-sm font-medium transition-colors ${
                goal === val
                  ? "border-[#722F3E] bg-[#722F3E] text-[#F4EFE6]"
                  : "border-[#2C221E]/20 bg-[#F4EFE6]/70 text-[#141514] hover:border-[#C8A46E]"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-4 h-11 w-full cursor-pointer rounded-[8px] bg-[#722F3E] px-4 text-sm font-semibold text-[#F4EFE6] transition-colors hover:bg-[#5E2532]"
          >
            Continuar
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5 space-y-2.5">
          {(
            [
              ["physical", "Livros físicos (capa dura, brochura, bolso)"],
              ["digital", "E-books (Kindle, EPUB, leitores digitais)"],
              ["audio", "Audiobooks (horas ouvidas e nota de narração)"],
            ] as const
          ).map(([kind, label]) => {
            const active = formats.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFormat(kind)}
                className={`flex min-h-[48px] w-full cursor-pointer items-center justify-between rounded-[8px] border px-4 text-left text-sm font-medium transition-colors ${
                  active
                    ? "border-[#722F3E] bg-[#722F3E] text-[#F4EFE6]"
                    : "border-[#2C221E]/20 bg-[#F4EFE6]/70 text-[#141514] hover:border-[#C8A46E]"
                }`}
              >
                <span>{label}</span>
                <span aria-hidden="true">{active ? "✓" : "+"}</span>
              </button>
            );
          })}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-11 cursor-pointer rounded-[8px] border border-[#2C221E]/20 bg-[#F4EFE6] px-4 text-sm font-semibold text-[#141514] transition-colors hover:border-[#C8A46E]"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="h-11 flex-1 cursor-pointer rounded-[8px] bg-[#722F3E] px-4 text-sm font-semibold text-[#F4EFE6] transition-colors hover:bg-[#5E2532]"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="onboarding-target"
              className="block text-sm font-medium text-[#141514]"
            >
              Livros para ler no ano (opcional — sem cobrança punitiva)
            </label>
            <input
              id="onboarding-target"
              type="number"
              min={0}
              max={500}
              value={annualTarget}
              onChange={(e) => setAnnualTarget(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[8px] border border-[#2C221E]/20 bg-[#F4EFE6]/70 px-3.5 text-sm text-[#141514] transition-all focus:border-[#C8A46E] focus:bg-[#FAF6F0] focus:outline-none focus:ring-2 focus:ring-[#C8A46E]/35"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => finishOnboarding("/adicionar")}
              className="h-11 w-full cursor-pointer rounded-[8px] bg-[#722F3E] px-4 text-sm font-semibold text-[#F4EFE6] transition-colors hover:bg-[#5E2532] disabled:opacity-60"
            >
              {isPending
                ? "Salvando..."
                : "Concluir e adicionar meu primeiro livro"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => finishOnboarding("/painel")}
              className="h-11 w-full cursor-pointer rounded-[8px] border border-[#2C221E]/20 bg-[#F4EFE6] px-4 text-sm font-semibold text-[#141514] transition-colors hover:border-[#C8A46E]"
            >
              Ir direto para o Painel vazio
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
