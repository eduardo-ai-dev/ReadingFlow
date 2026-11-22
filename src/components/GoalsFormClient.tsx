"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGoalAction, deleteGoalAction } from "@/features/goals/actions";

export function CreateGoalFormClient({
  defaultYear,
  defaultMonth = 1,
}: {
  defaultYear: number;
  defaultMonth?: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(`Meta de Leitura ${defaultYear}`);
  const [kind, setKind] = useState<"books" | "pages">("books");
  const [period, setPeriod] = useState<"year" | "month">("year");
  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState(String(defaultMonth));
  const [targetValue, setTargetValue] = useState("12");
  const [countRereads, setCountRereads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (submittingRef.current) return;
        setError(null);
        setSuccess(null);

        const cleanTitle = title.trim();
        if (!cleanTitle) {
          setError("Informe um título para a meta.");
          return;
        }

        const trimmedTarget = targetValue.trim();
        if (!/^\d+$/.test(trimmedTarget)) {
          setError("A meta deve ser um número inteiro maior que zero.");
          return;
        }
        const targetVal = Number.parseInt(trimmedTarget, 10);
        if (targetVal <= 0) {
          setError("A meta deve ser um número inteiro maior que zero.");
          return;
        }
        if (targetVal > 100000) {
          setError("A meta não pode ultrapassar 100.000.");
          return;
        }

        const trimmedYear = year.trim();
        if (!/^\d{4}$/.test(trimmedYear)) {
          setError("Informe um ano válido entre 2000 e 2100.");
          return;
        }
        const parsedYear = Number.parseInt(trimmedYear, 10);
        if (parsedYear < 2000 || parsedYear > 2100) {
          setError("Informe um ano válido entre 2000 e 2100.");
          return;
        }

        let parsedMonth: number | undefined;
        if (period === "month") {
          const trimmedMonth = month.trim();
          if (!/^\d{1,2}$/.test(trimmedMonth)) {
            setError("Informe um mês válido entre 1 e 12.");
            return;
          }
          const m = Number.parseInt(trimmedMonth, 10);
          if (m < 1 || m > 12) {
            setError("Informe um mês válido entre 1 e 12.");
            return;
          }
          parsedMonth = m;
        }

        submittingRef.current = true;
        startTransition(async () => {
          try {
            const res = await createGoalAction({
              title: cleanTitle,
              kind,
              period,
              year: parsedYear,
              month: parsedMonth,
              targetValue: targetVal,
              countRereads,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSuccess("Meta criada com sucesso.");
            router.refresh();
          } catch {
            setError("Não foi possível criar a meta agora. Tente novamente.");
          } finally {
            submittingRef.current = false;
          }
        });
      }}
      className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
    >
      <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
        Nova meta de leitura
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          Sugestões leves:
        </span>
        {[
          {
            label: "6 livros no ano",
            kind: "books" as const,
            target: "6",
            title: `Leituras de ${defaultYear}`,
          },
          {
            label: "12 livros no ano",
            kind: "books" as const,
            target: "12",
            title: `Leituras de ${defaultYear}`,
          },
          {
            label: "1.500 páginas no ano",
            kind: "pages" as const,
            target: "1500",
            title: `Páginas em ${defaultYear}`,
          },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setKind(preset.kind);
              setPeriod("year");
              setYear(String(defaultYear));
              setTargetValue(preset.target);
              setTitle(preset.title);
              setError(null);
            }}
            className="inline-flex min-h-[36px] items-center rounded-full border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--status-error)] bg-[var(--status-error-bg)] p-3 text-xs font-medium text-[var(--status-error)]"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-[8px] border border-[var(--status-ok)] bg-[var(--status-ok-bg)] p-3 text-xs font-medium text-[var(--status-ok)]"
        >
          {success}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="goal-title" className="block text-xs font-semibold">
            Nome da meta
          </label>
          <input
            id="goal-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
          />
        </div>

        <div>
          <label htmlFor="goal-kind" className="block text-xs font-semibold">
            Unidade
          </label>
          <select
            id="goal-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "books" | "pages")}
            className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
          >
            <option value="books">Livros concluídos</option>
            <option value="pages">Páginas lidas</option>
          </select>
        </div>

        <div>
          <label htmlFor="goal-target" className="block text-xs font-semibold">
            Quantidade desejada
          </label>
          <input
            id="goal-target"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
          />
        </div>

        <div>
          <label htmlFor="goal-period" className="block text-xs font-semibold">
            Período
          </label>
          <select
            id="goal-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as "year" | "month")}
            className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
          >
            <option value="year">Anual</option>
            <option value="month">Mensal</option>
          </select>
        </div>

        <div>
          <label htmlFor="goal-year" className="block text-xs font-semibold">
            Ano
          </label>
          <input
            id="goal-year"
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
          />
        </div>

        {period === "month" ? (
          <div>
            <label htmlFor="goal-month" className="block text-xs font-semibold">
              Mês (1–12)
            </label>
            <input
              id="goal-month"
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm lg:min-h-[42px]"
            />
          </div>
        ) : null}
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs lg:min-h-[36px]">
        <input
          type="checkbox"
          checked={countRereads}
          onChange={(e) => setCountRereads(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent-primary)]"
        />
        <span>Contabilizar releituras nesta meta</span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--on-primary)]"
      >
        Criar meta
      </button>
    </form>
  );
}

export function DeleteGoalButtonClient({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const res = await deleteGoalAction({ goalId });
                if (!res.ok) {
                  setError(res.error);
                  setConfirming(false);
                  return;
                }
                router.refresh();
              } catch {
                setError("Não foi possível remover a meta.");
                setConfirming(false);
              }
            });
          }}
          className="min-h-[44px] rounded-[6px] bg-[var(--status-error)] px-3 text-xs font-semibold text-white disabled:opacity-60 lg:min-h-[34px] lg:px-2.5"
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="min-h-[44px] rounded-[6px] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)] lg:min-h-[34px] lg:px-2.5"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="min-h-[44px] rounded-[6px] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-muted)] hover:text-[var(--status-error)] lg:min-h-[36px] lg:px-2.5"
      >
        Remover
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-[var(--status-error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
