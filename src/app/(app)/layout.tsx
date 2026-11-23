import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile, getUndoBannerInfo } from "@/features/auth/queries";
import { resolveSafeRedirectTarget } from "@/features/auth/rules";
import { DEMO_USER_ID } from "@/server/store/memory-repository";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  const isDemo = profile.id === DEMO_USER_ID;
  if (!isDemo && !profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  const undoInfo = isDemo ? null : await getUndoBannerInfo();

  return (
    <AppShell profile={profile} undoInfo={undoInfo} isDemo={isDemo}>
      {children}
    </AppShell>
  );
}
