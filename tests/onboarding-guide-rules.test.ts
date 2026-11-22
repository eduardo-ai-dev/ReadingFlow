import { describe, expect, it } from "vitest";
import { evaluateOnboardingGuide } from "@/features/onboarding/rules";

describe("Onboarding para conta vazia — guia dispensável e retomável (Etapa 4B)", () => {
  it("exibe o guia com os 3 passos corretos para conta nova sem livros e sem sessões", () => {
    const result = evaluateOnboardingGuide({
      ownedBooksCount: 0,
      goalsCount: 0,
      sessionsCount: 0,
    });

    expect(result.shouldShow).toBe(true);
    expect(result.isEmptyLibrary).toBe(true);
    expect(result.hasNoSessions).toBe(true);
    expect(result.completedCount).toBe(0);
    expect(result.totalCount).toBe(3);
    expect(result.steps.map((s) => s.title)).toEqual([
      "Adicione seu primeiro livro",
      "Defina uma meta anual",
      "Conheça o Canto de Foco",
    ]);
    // Nunca promete importação Goodreads CSV (rota /importar não existe)
    for (const step of result.steps) {
      expect(step.title.toLowerCase()).not.toContain("goodreads");
      expect(step.description.toLowerCase()).not.toContain("goodreads");
      expect(step.href).not.toContain("/importar");
    }
  });

  it("continua exibindo quando tem livro mas ainda sem sessões de leitura", () => {
    const result = evaluateOnboardingGuide({
      ownedBooksCount: 1,
      goalsCount: 0,
      sessionsCount: 0,
    });

    expect(result.shouldShow).toBe(true);
    expect(result.completedCount).toBe(1);
    expect(result.steps[0]?.completed).toBe(true);
    expect(result.steps[1]?.completed).toBe(false);
    expect(result.steps[2]?.completed).toBe(false);
  });

  it("some automaticamente ao concluir os 3 passos", () => {
    const result = evaluateOnboardingGuide({
      ownedBooksCount: 2,
      goalsCount: 1,
      sessionsCount: 3,
    });

    expect(result.allCompleted).toBe(true);
    expect(result.shouldShow).toBe(false);
  });

  it("some ao dispensar e reaparece quando retomado em Configurações -> Primeiros passos", () => {
    const dismissed = evaluateOnboardingGuide({
      ownedBooksCount: 0,
      goalsCount: 0,
      sessionsCount: 0,
      state: {
        dismissed: true,
        reopened: false,
        completedSteps: [],
      },
    });
    expect(dismissed.shouldShow).toBe(false);

    const reopened = evaluateOnboardingGuide({
      ownedBooksCount: 3,
      goalsCount: 1,
      sessionsCount: 5,
      state: {
        dismissed: false,
        reopened: true,
        completedSteps: [],
      },
    });
    expect(reopened.shouldShow).toBe(true);
  });

  it("não ativa automaticamente para a conta demonstrativa", () => {
    const demo = evaluateOnboardingGuide({
      ownedBooksCount: 0,
      goalsCount: 0,
      sessionsCount: 0,
      isDemoAccount: true,
    });
    expect(demo.shouldShow).toBe(false);
  });
});
