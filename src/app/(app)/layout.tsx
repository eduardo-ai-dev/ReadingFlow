import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile, getUndoBannerInfo } from "@/features/auth/queries";
import { resolveSafeRedirectTarget } from "@/features/auth/rules";
import { AppShell } from "@/components/AppShell";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    const hdrs = await headers();
    const rawOrigin = hdrs.get("x-rf-pathname");
    const safeOrigin = resolveSafeRedirectTarget(rawOrigin, "");
    redirect(
      safeOrigin ? `/entrar?next=${encodeURIComponent(safeOrigin)}` : "/entrar"
    );
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
