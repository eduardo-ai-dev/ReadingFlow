"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGoalAction, deleteGoalAction } from "@/features/goals/actions";

export function CreateGoalFormClient({ defaultYear }: { defaultYear: number }) {
  const router = useRouter();
  const [title, setTitle] = useState(`Meta de Leitura ${defaultYear}`);
  const [kind, setKind] = useState<"books" | "pages">("books");
  const [period, setPeriod] = useState<"year" | "month">("year");
  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState("11");
  const [targetValue, setTargetValue] = useState("12");
  const [countRereads, setCountRereads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        const cleanTitle = title.trim();
        if (!cleanTitle) {
          setError("Informe um título para a meta.");
          return;
        }

        const targetVal = Number.parseInt(targetValue, 10);
        if (!Number.isInteger(targetVal) || targetVal <= 0) {
          setError("A meta deve ser um número inteiro maior que zero.");
          return;
        }
        if (targetVal > 100000) {
          setError("A meta não pode ultrapassar 100.000.");
          return;
        }

        const parsedYear = Number.parseInt(year, 10);
        if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
          setError("Informe um ano válido entre 2000 e 2100.");
          return;
        }

        startTransition(async () => {
          const res = await createGoalAction({
            title: cleanTitle,
            kind,
            period,
            year: parsedYear,
            month: period === "month" ? Number.parseInt(month, 10) : undefined,
            targetValue: targetVal,
            countRereads,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.refresh();
        });
      }}
      className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
    >
      <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
        Nova meta de leitura
      </h2>

      {error ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--status-error)] bg-[var(--status-error-bg)] p-3 text-xs font-medium text-[var(--status-error)]"
        >
          {error}
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
            className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
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
            className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
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
            min={1}
            required
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
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
            className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
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
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
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
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
          </div>
        ) : null}
      </div>

      <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs">
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
        className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--on-primary)]"
      >
        Criar meta
      </button>
    </form>
  );
}

export function DeleteGoalButtonClient({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await deleteGoalAction({ goalId });
          router.refresh();
        });
      }}
      className="min-h-[36px] rounded-[6px] border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--status-error)]"
    >
      Remover
    </button>
  );
}
