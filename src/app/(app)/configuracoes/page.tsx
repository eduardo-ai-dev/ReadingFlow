import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/auth/queries";
import { getOnboardingGuideSummary } from "@/features/onboarding/queries";
import { SettingsClient } from "@/components/SettingsClient";

export const metadata: Metadata = {
  title: "Configurações e Privacidade",
};

export default async function SettingsPage() {
  const [profile, onboardingGuide] = await Promise.all([
    getCurrentProfile(),
    getOnboardingGuideSummary(),
  ]);
  if (!profile) {
    redirect("/entrar");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="editorial-kicker">
          Módulos L & M · Preferências, LGPD e Exportação
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Configurações
        </h1>
      </header>

      <SettingsClient profile={profile} onboardingGuide={onboardingGuide} />
    </div>
  );
}
