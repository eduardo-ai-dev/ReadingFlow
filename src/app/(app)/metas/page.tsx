import type { Metadata } from "next";
import { getEvaluatedGoals } from "@/features/goals/queries";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { ProgressBar } from "@/components/ProgressBar";
import { GoalPaceBadge } from "@/components/StatusBadge";
import { GoalCardActionsClient } from "@/components/GoalCardActionsClient";
import { MetricFormulaHint } from "@/components/MetricFormulaHint";
import {
  CreateGoalFormClient,
  DeleteGoalButtonClient,
} from "@/components/GoalsFormClient";
import { Stagger, Item } from "@/components/MotionPrimitives";

export const metadata: Metadata = {
  title: "Metas de Leitura",
};

export default async function GoalsPage() {
  const data = await getEvaluatedGoals();
  const currentYear = Number(data.todayYmd.slice(0, 4));
  const currentMonth = Number(data.todayYmd.slice(5, 7));

  return (
    <div className="space-y-8">
      <header>
        <p className="editorial-kicker">
          Acompanhamento por viabilidade real · Sem pressão
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Metas de Leitura
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Metas pensadas para o seu ritmo real — ajuste, adie ou pause quando
          quiser, sem penalidade (hoje: {formatDisplayDatePtBr(data.todayYmd)}).
        </p>
      </header>

      {data.entries.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
          <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
            Nenhuma meta criada ainda
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">
            Definir uma meta é totalmente opcional. Se quiser um norte leve para
            o ano ou para o mês, escolha uma sugestão abaixo ou personalize a
            sua.
          </p>
        </div>
      ) : (
        <Stagger className="grid gap-4 lg:grid-cols-2">
          {data.entries.map(({ goal, evaluation }) => (
            <Item
              key={goal.id}
              className="card flex flex-col justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
                      {goal.title}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDisplayDatePtBr(goal.startsOn)} a{" "}
                      {formatDisplayDatePtBr(goal.endsOn)} ·{" "}
                      {goal.countRereads
                        ? "Inclui releituras"
                        : "Sem releituras"}
                    </p>
                  </div>
                  <GoalPaceBadge status={evaluation.paceStatus} />
                </div>

                {/* Progresso em primeiro lugar */}
                <p className="mt-4 font-serif text-2xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-heading)]">
                  {evaluation.progressHeadlinePtBr}
                </p>

                <div className="mt-2.5">
                  <ProgressBar
                    value={evaluation.progressPercent}
                    label={`Progresso da meta ${goal.title}`}
                  />
                </div>

                {/* Ação concreta */}
                <p className="mt-3 text-sm font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-primary)]">
                  {evaluation.concreteActionPtBr}
                </p>

                {evaluation.hasEnoughData &&
                evaluation.paceStatus !== "completed" &&
                evaluation.paceStatus !== "paused" ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                    <span className="font-semibold text-[var(--rf-text-accent-secondary)]">
                      Necessário: {evaluation.requiredPerDayFormatted}
                    </span>
                    <MetricFormulaHint
                      basisLabel="ver fórmula"
                      formula={evaluation.requiredFormulaTooltip}
                    />
                  </div>
                ) : null}

                {evaluation.realisticAlternativePtBr ? (
                  <p className="mt-2.5 rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-secondary)] bg-[var(--rf-accent-secondary-subtle)] px-3 py-2 text-xs font-medium text-[var(--rf-text-accent-secondary)]">
                    {evaluation.realisticAlternativePtBr}
                  </p>
                ) : null}

                <GoalCardActionsClient
                  goalId={goal.id}
                  goalTitle={goal.title}
                  goalKind={goal.kind}
                  targetValue={goal.targetValue}
                  startsOn={goal.startsOn}
                  endsOn={goal.endsOn}
                  paused={goal.paused}
                  paceStatus={evaluation.paceStatus}
                  suggestedTargetValue={evaluation.suggestedTargetValue}
                  realisticAlternativePtBr={evaluation.realisticAlternativePtBr}
                  howToReachStepsPtBr={evaluation.howToReachStepsPtBr}
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
                <span>
                  {evaluation.remainingDays === 1
                    ? "Resta 1 dia no período"
                    : `Restam ${evaluation.remainingDays} dias no período`}
                </span>
                <DeleteGoalButtonClient goalId={goal.id} />
              </div>
            </Item>
          ))}
        </Stagger>
      )}

      <CreateGoalFormClient
        defaultYear={currentYear}
        defaultMonth={currentMonth}
      />
    </div>
  );
}
