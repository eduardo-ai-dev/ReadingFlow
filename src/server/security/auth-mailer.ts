import { logAuthEvent } from "@/server/security/auth-logger";

export type AuthMailKind =
  | "email_confirmation"
  | "password_reset"
  | "magic_link_otp"
  | "lockout_alert"
  | "password_changed_notice"
  | "signup_existing_account_notice";

export interface DispatchedAuthMail {
  kind: AuthMailKind;
  accountHmac: string;
  sentAtIso: string;
  /** Em testes locais, armazena o código/token apenas em memória privada para verificação E2E/unitária (nunca em logs). */
  testOnlySecret?: string;
}

const globalMailer = globalThis as unknown as {
  __rfAuthMailOutbox?: DispatchedAuthMail[];
  __rfConfirmationResendLastMs?: Map<string, number>;
};

const CONFIRMATION_RESEND_COOLDOWN_MS = 120_000; // 2 min por conta

function getOutbox(): DispatchedAuthMail[] {
  if (!globalMailer.__rfAuthMailOutbox) {
    globalMailer.__rfAuthMailOutbox = [];
  }
  return globalMailer.__rfAuthMailOutbox;
}

function getResendMap(): Map<string, number> {
  if (!globalMailer.__rfConfirmationResendLastMs) {
    globalMailer.__rfConfirmationResendLastMs = new Map<string, number>();
  }
  return globalMailer.__rfConfirmationResendLastMs;
}

export function getDispatchedAuthMailsForTests(): DispatchedAuthMail[] {
  return [...getOutbox()];
}

export function clearDispatchedAuthMailsForTests(): void {
  getOutbox().length = 0;
  getResendMap().clear();
}

/**
 * Despacha e-mail transacional de segurança em segundo plano sem jamais registrar
 * e-mail em claro, senha ou token secreto nos logs.
 */
export async function dispatchAuthEmail(params: {
  kind: AuthMailKind;
  toEmail: string;
  accountHmac: string;
  requestId?: string;
  clientIp?: string | null;
  userAgent?: string | null;
  secretCodeForDelivery?: string;
  nowMs?: number;
}): Promise<{ dispatched: boolean; rateLimited?: boolean }> {
  const nowMs = params.nowMs ?? Date.now();

  if (params.kind === "email_confirmation") {
    const resendMap = getResendMap();
    const lastMs = resendMap.get(params.accountHmac) ?? 0;
    if (nowMs - lastMs < CONFIRMATION_RESEND_COOLDOWN_MS) {
      return { dispatched: false, rateLimited: true };
    }
    resendMap.set(params.accountHmac, nowMs);
  }

  // Em produção com provedor SMTP/Resend/Supabase, integraria o envio aqui usando `params.toEmail` e `params.secretCodeForDelivery`.
  // Nunca escreve e-mail em claro ou token secreto em stdout/stderr.
  const outbox = getOutbox();
  if (outbox.length > 500) {
    outbox.splice(0, outbox.length - 500);
  }
  outbox.push({
    kind: params.kind,
    accountHmac: params.accountHmac,
    sentAtIso: new Date(nowMs).toISOString(),
    ...(process.env.NODE_ENV === "test" || process.env.VITEST
      ? { testOnlySecret: params.secretCodeForDelivery }
      : {}),
  });

  if (params.kind === "email_confirmation") {
    logAuthEvent({
      event: "confirmation_resent",
      requestId: params.requestId,
      accountHmac: params.accountHmac,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      internalReason: "unconfirmed_account_silent_resend",
    });
  } else if (params.kind === "lockout_alert") {
    logAuthEvent({
      event: "lockout_alert_dispatched",
      requestId: params.requestId,
      accountHmac: params.accountHmac,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      internalReason: "first_lockout_owner_alert",
    });
  }

  return { dispatched: true };
}
