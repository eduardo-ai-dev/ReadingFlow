import type { OnboardingGuideState, OnboardingStepId } from "@/lib/domain";

export interface OnboardingGuideStep {
  id: OnboardingStepId;
  order: 1 | 2 | 3;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  optional: boolean;
  completed: boolean;
}

export interface OnboardingGuideEvaluation {
  shouldShow: boolean;
  isEmptyLibrary: boolean;
  hasNoSessions: boolean;
  dismissed: boolean;
  reopened: boolean;
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
  steps: OnboardingGuideStep[];
}

export const DEFAULT_ONBOARDING_GUIDE_STATE: OnboardingGuideState = {
  dismissed: false,
  reopened: false,
  completedSteps: [],
};

/**
 * Avalia o guia de primeiros passos para contas novas ou sem sessões.
 * - Detecta conta sem livros (`ownedBooksCount === 0`) ou sem sessões (`sessionsCount === 0`).
 * - Some automaticamente ao concluir os 3 passos ou ao dispensar.
 * - Pode ser retomado a qualquer momento em Configurações -> Primeiros passos (`reopened: true`).
 * - Não promete importação de Goodreads CSV (rota `/importar` ainda não disponível).
 */
export function evaluateOnboardingGuide(params: {
  ownedBooksCount: number;
  goalsCount: number;
  sessionsCount: number;
  state?: OnboardingGuideState;
  isDemoAccount?: boolean;
}): OnboardingGuideEvaluation {
  const safeState: OnboardingGuideState = params.state ?? {
    ...DEFAULT_ONBOARDING_GUIDE_STATE,
  };
  const manualCompleted = new Set<OnboardingStepId>(
    safeState.completedSteps ?? []
  );

  const isEmptyLibrary = params.ownedBooksCount <= 0;
  const hasNoSessions = params.sessionsCount <= 0;

  const firstBookDone =
    params.ownedBooksCount > 0 || manualCompleted.has("first_book");
  const annualGoalDone =
    params.goalsCount > 0 || manualCompleted.has("annual_goal");
  const focusCornerDone =
    params.sessionsCount > 0 || manualCompleted.has("focus_corner");

  const steps: OnboardingGuideStep[] = [
    {
      id: "first_book",
      order: 1,
      title: "Adicione seu primeiro livro",
      description:
        "Busque por título ou ISBN e escolha a edição e a capa no seletor para começar sua estante.",
      actionLabel: firstBookDone ? "Adicionar outro livro" : "Adicionar livro",
      href: "/adicionar",
      optional: false,
      completed: firstBookDone,
    },
    {
      id: "annual_goal",
      order: 2,
      title: "Defina uma meta anual",
      description:
        "Opcional e sem pressão: escolha uma sugestão leve (como 6 ou 12 livros no ano) e ajuste quando quiser.",
      actionLabel: annualGoalDone ? "Ver minhas metas" : "Definir meta",
      href: "/metas",
      optional: true,
      completed: annualGoalDone,
    },
    {
      id: "focus_corner",
      order: 3,
      title: "Conheça o Canto de Foco",
      description:
        "Um espaço silencioso com cronômetro de sessão e sons ambiente para ler sem distrações.",
      actionLabel: focusCornerDone ? "Abrir Canto de Foco" : "Conhecer agora",
      href: "/leitura/foco",
      optional: false,
      completed: focusCornerDone,
    },
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const allCompleted = completedCount === totalCount;
  const dismissed = Boolean(safeState.dismissed);
  const reopened = Boolean(safeState.reopened);

  const needsOnboarding = isEmptyLibrary || hasNoSessions;

  let shouldShow = false;
  if (reopened && !dismissed) {
    shouldShow = true;
  } else if (!params.isDemoAccount && !dismissed && !allCompleted) {
    shouldShow = needsOnboarding;
  }

  return {
    shouldShow,
    isEmptyLibrary,
    hasNoSessions,
    dismissed,
    reopened,
    completedCount,
    totalCount,
    allCompleted,
    steps,
  };
}
