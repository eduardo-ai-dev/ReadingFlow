import type { Metadata } from "next";
import { getEvaluatedGoals } from "@/features/goals/queries";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { ProgressBar } from "@/components/ProgressBar";
import { GoalPaceBadge } from "@/components/StatusBadge";
import {
  CreateGoalFormClient,
  DeleteGoalButtonClient,
} from "@/components/GoalsFormClient";
import { CountUp, Stagger, Item } from "@/components/MotionPrimitives";

export const metadata: Metadata = {
  title: "Metas de Leitura",
};

export default async function GoalsPage() {
  const data = await getEvaluatedGoals();
  const currentYear = Number(data.todayYmd.slice(0, 4));

  return (
    <div className="space-y-8">
      <header>
        <p className="editorial-kicker">Ritmo neutro e tolerância de 5%</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Metas de Leitura
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acompanhamento informativo e sem mensagens punitivas (hoje:{" "}
          {formatDisplayDatePtBr(data.todayYmd)}).
        </p>
      </header>

      <Stagger className="grid gap-4 lg:grid-cols-2">
        {data.entries.map(({ goal, evaluation }) => (
          <Item
            key={goal.id}
            className="card flex flex-col justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
                    {goal.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDisplayDatePtBr(goal.startsOn)} a{" "}
                    {formatDisplayDatePtBr(goal.endsOn)} ·{" "}
                    {goal.countRereads ? "Inclui releituras" : "Sem releituras"}
                  </p>
                </div>
                <GoalPaceBadge status={evaluation.paceStatus} />
              </div>

              <p className="mt-4 font-serif text-2xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-heading)]">
                <CountUp to={evaluation.completedValue} /> de {evaluation.targetValue}{" "}
                {goal.kind === "books" ? "livros" : "páginas"} (
                <CountUp to={evaluation.progressPercent} />%)
              </p>

              <div className="mt-2.5">
                <ProgressBar
                  value={evaluation.progressPercent}
                  label={`Progresso da meta ${goal.title}`}
                />
              </div>

              <p className="mt-3 text-sm tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-primary)]">
                {evaluation.neutralMessagePtBr}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
              <span>Restam {evaluation.remainingDays} dias no período</span>
              <DeleteGoalButtonClient goalId={goal.id} />
            </div>
          </Item>
        ))}
      </Stagger>

      <CreateGoalFormClient defaultYear={currentYear} />
    </div>
  );
}
