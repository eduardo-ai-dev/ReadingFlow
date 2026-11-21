import { fail } from "k6";

const ALLOWED_EXACT_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];
const ALLOWED_SUFFIXES = [".local", ".test", ".localhost"];

export function enforceK6Safety() {
  if (__ENV.LOADTEST_ALLOW !== "1") {
    fail(
      "[SAFETY ABORT] Defina LOADTEST_ALLOW=1 para executar scripts k6 do ReadingFlow."
    );
  }

  const appUrl = __ENV.LOADTEST_BASE_URL || "http://127.0.0.1:3000";
  const supabaseUrl =
    __ENV.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const stagingHost = (__ENV.LOADTEST_STAGING_HOST || "").toLowerCase();

  for (const [label, raw] of [
    ["LOADTEST_BASE_URL", appUrl],
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ]) {
    const match = /^https?:\/\/([^/:]+)/i.exec(raw);
    const host = match ? match[1].toLowerCase() : "";
    const isExact = ALLOWED_EXACT_HOSTS.indexOf(host) !== -1;
    const isSuffix = ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
    const isStaging =
      stagingHost &&
      host === stagingHost &&
      (host.indexOf("staging") !== -1 || host.indexOf("loadtest") !== -1);

    if (!isExact && !isSuffix && !isStaging) {
      fail(
        `[SAFETY ABORT] Host "${host}" em ${label} (${raw}) fora da allowlist (localhost/staging).`
      );
    }
  }

  return {
    appBaseUrl: appUrl.replace(/\/$/, ""),
    supabaseBaseUrl: supabaseUrl.replace(/\/$/, ""),
  };
}
