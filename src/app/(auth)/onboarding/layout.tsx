import { redirect } from "next/navigation";
import {
  isDemoWorkspace,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await requireAuthenticatedWorkspace();
  if (isDemoWorkspace(ws)) {
    redirect("/painel");
  }
  return <>{children}</>;
}
