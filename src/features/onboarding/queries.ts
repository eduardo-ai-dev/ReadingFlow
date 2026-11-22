import "server-only";
import {
  DEMO_USER_ID,
  cachedWorkspaceQuery,
  ensureWorkspaceSettings,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import {
  evaluateOnboardingGuide,
  type OnboardingGuideEvaluation,
} from "@/features/onboarding/rules";

export async function getOnboardingGuideSummary(): Promise<OnboardingGuideEvaluation> {
  const ws = await requireAuthenticatedWorkspace();
  return cachedWorkspaceQuery(ws, "onboarding:guide", () => {
    const settings = ensureWorkspaceSettings(ws);
    const ownedBooksCount = ws.items.filter(
      (item) => item.status === "owned" || item.status === "lent"
    ).length;
    const goalsCount = ws.goals.length;
    const sessionsCount = ws.readings.reduce((acc, reading) => {
      if (reading.dailyLogs && reading.dailyLogs.length > 0) {
        return acc + reading.dailyLogs.length;
      }
      if (
        reading.status === "finished" ||
        reading.status === "reading" ||
        reading.status === "paused"
      ) {
        return acc + 1;
      }
      return acc;
    }, 0);

    return evaluateOnboardingGuide({
      ownedBooksCount,
      goalsCount,
      sessionsCount,
      state: settings.onboardingGuide,
      isDemoAccount: ws.profile.id === DEMO_USER_ID,
    });
  });
}
