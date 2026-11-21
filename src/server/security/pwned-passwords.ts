import crypto from "node:crypto";
import { getAuthSecurityConfig } from "@/server/security/auth-config";

export interface PwnedCheckResult {
  compromised: boolean;
  breachCount: number;
  checked: boolean;
  unavailable?: boolean;
}

type CustomRangeFetcher = (prefix5: string) => Promise<string | null>;

const globalHibp = globalThis as unknown as {
  __rfHibpCustomFetcher?: CustomRangeFetcher | null;
};

/**
 * Permite injetar um provedor simulado em testes unitários/integração
 * sem realizar chamadas de rede externas.
 */
export function setPwnedRangeFetcherForTests(
  fetcher: CustomRangeFetcher | null
): void {
  globalHibp.__rfHibpCustomFetcher = fetcher;
}

/**
 * Consulta k-anonymity ao Pwned Passwords (HIBP), executada EXCLUSIVAMENTE no servidor
 * no cadastro, redefinição e troca de senha:
 * - Envia somente os 5 primeiros hex do SHA-1 da senha (`Add-Padding: true`).
 * - A senha em claro ou o hash completo jamais saem do servidor.
 */
export async function checkPwnedPasswordServer(
  password: string
): Promise<PwnedCheckResult> {
  const cfg = getAuthSecurityConfig();
  if (!cfg.hibpEnabled && !globalHibp.__rfHibpCustomFetcher) {
    return { compromised: false, breachCount: 0, checked: false };
  }

  const sha1 = crypto
    .createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  let body: string | null = null;

  if (globalHibp.__rfHibpCustomFetcher) {
    try {
      body = await globalHibp.__rfHibpCustomFetcher(prefix);
    } catch {
      return {
        compromised: false,
        breachCount: 0,
        checked: false,
        unavailable: true,
      };
    }
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.hibpTimeoutMs);
    try {
      const res = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          method: "GET",
          headers: {
            "Add-Padding": "true",
            "User-Agent": "ReadingFlow-AuthSecurity/1.0",
          },
          signal: controller.signal,
          cache: "no-store",
        }
      );
      if (!res.ok) {
        return {
          compromised: false,
          breachCount: 0,
          checked: false,
          unavailable: true,
        };
      }
      body = await res.text();
    } catch {
      return {
        compromised: false,
        breachCount: 0,
        checked: false,
        unavailable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  if (!body) {
    return {
      compromised: false,
      breachCount: 0,
      checked: false,
      unavailable: true,
    };
  }

  for (const line of body.split(/\r?\n/)) {
    const [lineSuffix, countRaw] = line.trim().split(":");
    if (lineSuffix?.toUpperCase() === suffix) {
      const breachCount = Number.parseInt(countRaw ?? "0", 10);
      if (Number.isFinite(breachCount) && breachCount > 0) {
        return { compromised: true, breachCount, checked: true };
      }
    }
  }

  return { compromised: false, breachCount: 0, checked: true };
}
