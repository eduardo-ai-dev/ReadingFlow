import { redirect } from "next/navigation";
import { getCurrentProfile, getUndoBannerInfo } from "@/features/auth/queries";
import { AppShell } from "@/components/AppShell";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/entrar");
  }
  if (!profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  const undoInfo = await getUndoBannerInfo();

  return (
    <AppShell profile={profile} undoInfo={undoInfo}>
      {children}
    </AppShell>
  );
}
