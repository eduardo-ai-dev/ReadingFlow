import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/server/db/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const report = await checkDatabaseHealth();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
