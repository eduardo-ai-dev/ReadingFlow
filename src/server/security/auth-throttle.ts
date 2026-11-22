import crypto from "node:crypto";
import {
  getCloudflareD1Binding,
  getD1Database,
  getTestSqliteDatabase,
} from "@/server/db/connection";
import { getAuthSecurityConfig } from "@/server/security/auth-config";
import {
  computeAccountHmac,
  hashAppSecretArgon2id,
  normalizeClientIp,
  verifyAppSecretArgon2id,
} from "@/server/security/secrets";

export type ThrottleScopeType = "account" | "ip" | "pair" | "device_account";

export interface AttemptRow {
  scope_type: ThrottleScopeType;
  scope_key: string;
  consecutive_failures: number;
  window_started_at_ms: number;
  locked_until_ms: number;
  lockout_level: number;
  last_failure_at_ms: number;
  last_success_at_ms: number;
  alert_sent_at_ms: number;
  updated_at_ms: number;
}

export interface PreAuthGateDecision {
  allowed: boolean;
  blockedBy?:
    "account_lockout" | "ip_limit" | "pair_lockout" | "captcha_required";
  retryAfterSeconds: number;
  attackModeActive: boolean;
  requiresCaptcha: boolean;
  isKnownDevice: boolean;
}

export interface RecordedFailureResult {
  accountFailures: number;
  accountLockoutStarted: boolean;
  accountLockoutLevel: number;
  accountRetryAfterSeconds: number;
  accountWasAlreadyLocked: boolean;
  shouldSendLockoutAlert: boolean;
  ipFailures: number;
  ipLocked: boolean;
  attackModeTriggeredNow: boolean;
  attackModeActive: boolean;
}

const memAttempts = new Map<string, AttemptRow>();
const memAttackEvents: Array<{
  ip_key: string;
  account_hmac: string;
  created_at_ms: number;
}> = [];
let memAttackModeUntilMs = 0;

function attemptMapKey(scopeType: ThrottleScopeType, scopeKey: string): string {
  return `${scopeType}:${scopeKey}`;
}

function runImmediateTx<T>(fn: () => T): T {
  const db = getTestSqliteDatabase();
  if (!db) {
    return fn();
  }
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

function readAttemptRow(
  scopeType: ThrottleScopeType,
  scopeKey: string
): AttemptRow | null {
  const db = getTestSqliteDatabase();
  if (!db) {
    return memAttempts.get(attemptMapKey(scopeType, scopeKey)) ?? null;
  }
  const row = db
    .prepare(
      `SELECT scope_type, scope_key, consecutive_failures, window_started_at_ms,
              locked_until_ms, lockout_level, last_failure_at_ms, last_success_at_ms,
              alert_sent_at_ms, updated_at_ms
       FROM auth_login_attempts
       WHERE scope_type = ? AND scope_key = ?`
    )
    .get(scopeType, scopeKey) as AttemptRow | undefined;
  return row ?? null;
}

function upsertAttemptRow(row: AttemptRow): void {
  const db = getTestSqliteDatabase();
  if (!db) {
    memAttempts.set(attemptMapKey(row.scope_type, row.scope_key), { ...row });
    const d1 = getCloudflareD1Binding();
    if (d1) {
      void d1
        .prepare(
          `INSERT INTO auth_login_attempts (
            scope_type, scope_key, consecutive_failures, window_started_at_ms,
            locked_until_ms, lockout_level, last_failure_at_ms, last_success_at_ms,
            alert_sent_at_ms, updated_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope_type, scope_key) DO UPDATE SET
            consecutive_failures = excluded.consecutive_failures,
            window_started_at_ms = excluded.window_started_at_ms,
            locked_until_ms = excluded.locked_until_ms,
            lockout_level = excluded.lockout_level,
            last_failure_at_ms = excluded.last_failure_at_ms,
            last_success_at_ms = excluded.last_success_at_ms,
            alert_sent_at_ms = excluded.alert_sent_at_ms,
            updated_at_ms = excluded.updated_at_ms`
        )
        .bind(
          row.scope_type,
          row.scope_key,
          row.consecutive_failures,
          row.window_started_at_ms,
          row.locked_until_ms,
          row.lockout_level,
          row.last_failure_at_ms,
          row.last_success_at_ms,
          row.alert_sent_at_ms,
          row.updated_at_ms
        )
        .run()
        .catch(() => {});
    }
    return;
  }
  db.prepare(
    `INSERT INTO auth_login_attempts (
      scope_type, scope_key, consecutive_failures, window_started_at_ms,
      locked_until_ms, lockout_level, last_failure_at_ms, last_success_at_ms,
      alert_sent_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope_type, scope_key) DO UPDATE SET
      consecutive_failures = excluded.consecutive_failures,
      window_started_at_ms = excluded.window_started_at_ms,
      locked_until_ms = excluded.locked_until_ms,
      lockout_level = excluded.lockout_level,
      last_failure_at_ms = excluded.last_failure_at_ms,
      last_success_at_ms = excluded.last_success_at_ms,
      alert_sent_at_ms = excluded.alert_sent_at_ms,
      updated_at_ms = excluded.updated_at_ms`
  ).run(
    row.scope_type,
    row.scope_key,
    row.consecutive_failures,
    row.window_started_at_ms,
    row.locked_until_ms,
    row.lockout_level,
    row.last_failure_at_ms,
    row.last_success_at_ms,
    row.alert_sent_at_ms,
    row.updated_at_ms
  );
}

function readAttackModeUntilMs(): number {
  const db = getTestSqliteDatabase();
  if (!db) {
    return memAttackModeUntilMs;
  }
  const row = db
    .prepare(
      `SELECT value_int FROM auth_security_state WHERE state_key = 'attack_mode_until_ms'`
    )
    .get() as { value_int?: number } | undefined;
  return Number(row?.value_int ?? 0);
}

function writeAttackModeUntilMs(untilMs: number, nowMs: number): void {
  const db = getTestSqliteDatabase();
  if (!db) {
    memAttackModeUntilMs = untilMs;
    const d1 = getCloudflareD1Binding();
    if (d1) {
      void d1
        .prepare(
          `INSERT INTO auth_security_state (state_key, value_int, updated_at_ms)
           VALUES ('attack_mode_until_ms', ?, ?)
           ON CONFLICT(state_key) DO UPDATE SET
             value_int = excluded.value_int,
             updated_at_ms = excluded.updated_at_ms`
        )
        .bind(untilMs, nowMs)
        .run()
        .catch(() => {});
    }
    return;
  }
  db.prepare(
    `INSERT INTO auth_security_state (state_key, value_int, updated_at_ms)
     VALUES ('attack_mode_until_ms', ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET
       value_int = excluded.value_int,
       updated_at_ms = excluded.updated_at_ms`
  ).run(untilMs, nowMs);
}

function computeLockoutDurationSeconds(
  level: number,
  steps: readonly number[]
): number {
  const safeSteps = steps.length > 0 ? steps : [60, 300, 900, 3600];
  const idx = Math.max(0, Math.min(safeSteps.length - 1, level - 1));
  return safeSteps[idx] ?? 3600;
}

/**
 * Avalia atomicamente o gate pré-autenticação:
 * - Modo ataque global (muitas contas distintas falhando de poucos IPs): exige CAPTCHA para todos e reduz limite de IP pela metade.
 * - Bloqueio por conta (ou isolado por dispositivo conhecido): tentativas durante o bloqueio NÃO estendem o tempo nem incrementam falhas.
 * - Limite por IP (IPv6 /64) e par (IP, conta).
 * - Degrau de CAPTCHA para dispositivos desconhecidos antes do bloqueio duro.
 */
export function evaluatePreAuthGate(params: {
  accountHmac: string;
  clientIp: string;
  knownDeviceId?: string | null;
  nowMs?: number;
}): PreAuthGateDecision {
  const cfg = getAuthSecurityConfig();
  const nowMs = params.nowMs ?? Date.now();
  const ipKey = normalizeClientIp(params.clientIp);
  const pairKey = `${ipKey}:${params.accountHmac}`;
  const isKnownDevice = Boolean(params.knownDeviceId);
  const deviceAccountKey = params.knownDeviceId
    ? `${params.knownDeviceId}:${params.accountHmac}`
    : null;

  return runImmediateTx(() => {
    const attackUntilMs = readAttackModeUntilMs();
    const attackModeActive = attackUntilMs > nowMs;

    // 1. Verifica bloqueio por IP (5 min)
    const ipRow = readAttemptRow("ip", ipKey);
    if (ipRow && ipRow.locked_until_ms > nowMs) {
      return {
        allowed: false,
        blockedBy: "ip_limit",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((ipRow.locked_until_ms - nowMs) / 1000)
        ),
        attackModeActive,
        requiresCaptcha: false,
        isKnownDevice,
      };
    }

    // 2. Verifica bloqueio da conta (ou do dispositivo conhecido para mitigar DoS malicioso contra a vítima)
    const accountScopeType: ThrottleScopeType = isKnownDevice
      ? "device_account"
      : "account";
    const accountScopeKey =
      isKnownDevice && deviceAccountKey ? deviceAccountKey : params.accountHmac;
    const primaryRow = readAttemptRow(accountScopeType, accountScopeKey);

    if (primaryRow && primaryRow.locked_until_ms > nowMs) {
      return {
        allowed: false,
        blockedBy: "account_lockout",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((primaryRow.locked_until_ms - nowMs) / 1000)
        ),
        attackModeActive,
        requiresCaptcha: false,
        isKnownDevice,
      };
    }

    // 3. Verifica bloqueio do par (IP, conta)
    const pairRow = readAttemptRow("pair", pairKey);
    if (pairRow && pairRow.locked_until_ms > nowMs) {
      return {
        allowed: false,
        blockedBy: "pair_lockout",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((pairRow.locked_until_ms - nowMs) / 1000)
        ),
        attackModeActive,
        requiresCaptcha: false,
        isKnownDevice,
      };
    }

    // 4. Exige CAPTCHA no Modo Ataque para todos OU como degrau pré-bloqueio para dispositivos desconhecidos
    const accountWindowMs = cfg.accountWindowSeconds * 1000;
    const recentAccountFailures =
      primaryRow && nowMs - primaryRow.window_started_at_ms <= accountWindowMs
        ? primaryRow.consecutive_failures
        : 0;

    const captchaRequiredByStep =
      !isKnownDevice &&
      cfg.captchaProvider !== "none" &&
      recentAccountFailures >= cfg.captchaFailStepBeforeLockout;

    const captchaRequiredByAttack =
      attackModeActive && cfg.captchaProvider !== "none";

    const requiresCaptcha = captchaRequiredByAttack || captchaRequiredByStep;

    return {
      allowed: true,
      retryAfterSeconds: 0,
      attackModeActive,
      requiresCaptcha,
      isKnownDevice,
    };
  });
}

function applyAccountFailureToRow(
  existing: AttemptRow | null,
  scopeType: ThrottleScopeType,
  scopeKey: string,
  nowMs: number,
  threshold: number,
  windowMs: number,
  decayMs: number,
  steps: readonly number[]
): {
  row: AttemptRow;
  wasAlreadyLocked: boolean;
  lockoutStarted: boolean;
  retryAfterSeconds: number;
  shouldSendAlert: boolean;
} {
  // Tentativas durante bloqueio NÃO estendem o bloqueio nem contam como nova falha
  if (existing && existing.locked_until_ms > nowMs) {
    return {
      row: existing,
      wasAlreadyLocked: true,
      lockoutStarted: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.locked_until_ms - nowMs) / 1000)
      ),
      shouldSendAlert: false,
    };
  }

  let lockoutLevel = existing?.lockout_level ?? 0;
  // Reincidência volta ao nível inicial após 24h sem falhas
  if (
    existing &&
    existing.last_failure_at_ms > 0 &&
    nowMs - existing.last_failure_at_ms >= decayMs
  ) {
    lockoutLevel = 0;
  }

  let consecutiveFailures = existing?.consecutive_failures ?? 0;
  let windowStartedAt = existing?.window_started_at_ms ?? nowMs;

  if (
    !existing ||
    windowStartedAt === 0 ||
    nowMs - windowStartedAt > windowMs
  ) {
    consecutiveFailures = 0;
    windowStartedAt = nowMs;
  }

  consecutiveFailures += 1;

  let lockedUntilMs = 0;
  let lockoutStarted = false;
  let retryAfterSeconds = 0;
  let alertSentAtMs = existing?.alert_sent_at_ms ?? 0;
  let shouldSendAlert = false;

  if (consecutiveFailures >= threshold) {
    lockoutLevel = Math.min(steps.length, lockoutLevel + 1);
    retryAfterSeconds = computeLockoutDurationSeconds(lockoutLevel, steps);
    lockedUntilMs = nowMs + retryAfterSeconds * 1000;
    // Reinicia contador consecutivo para a próxima rodada pós-bloqueio
    consecutiveFailures = 0;
    windowStartedAt = nowMs;
    lockoutStarted = true;

    // Alerta ao dono após o 1º bloqueio (com resfriamento de 24h)
    if (
      scopeType === "account" &&
      lockoutLevel === 1 &&
      nowMs - alertSentAtMs >= decayMs
    ) {
      alertSentAtMs = nowMs;
      shouldSendAlert = true;
    }
  }

  const nextRow: AttemptRow = {
    scope_type: scopeType,
    scope_key: scopeKey,
    consecutive_failures: consecutiveFailures,
    window_started_at_ms: windowStartedAt,
    locked_until_ms: lockedUntilMs,
    lockout_level: lockoutLevel,
    last_failure_at_ms: nowMs,
    last_success_at_ms: existing?.last_success_at_ms ?? 0,
    alert_sent_at_ms: alertSentAtMs,
    updated_at_ms: nowMs,
  };

  upsertAttemptRow(nextRow);
  return {
    row: nextRow,
    wasAlreadyLocked: false,
    lockoutStarted,
    retryAfterSeconds,
    shouldSendAlert,
  };
}

/**
 * Registra uma falha de credencial de forma 100% atômica em SQLite (`BEGIN IMMEDIATE`).
 * Funciona de forma idêntica para e-mails existentes e inexistentes.
 */
export function recordAuthFailureAtomic(params: {
  accountHmac: string;
  clientIp: string;
  knownDeviceId?: string | null;
  nowMs?: number;
}): RecordedFailureResult {
  const cfg = getAuthSecurityConfig();
  const nowMs = params.nowMs ?? Date.now();
  const ipKey = normalizeClientIp(params.clientIp);
  const pairKey = `${ipKey}:${params.accountHmac}`;
  const accountWindowMs = cfg.accountWindowSeconds * 1000;
  const decayMs = cfg.lockoutDecayHours * 3600 * 1000;
  const ipWindowMs = cfg.ipWindowSeconds * 1000;
  const pairWindowMs = cfg.pairWindowSeconds * 1000;

  return runImmediateTx(() => {
    const db = getTestSqliteDatabase();
    let attackUntilMs = readAttackModeUntilMs();
    let attackModeActive = attackUntilMs > nowMs;
    let attackModeTriggeredNow = false;

    // 1. Atualiza conta (e dispositivo conhecido se presente)
    const existingAccount = readAttemptRow("account", params.accountHmac);
    const acctRes = applyAccountFailureToRow(
      existingAccount,
      "account",
      params.accountHmac,
      nowMs,
      cfg.accountFailThreshold,
      accountWindowMs,
      decayMs,
      cfg.lockoutStepsSeconds
    );

    let effectiveRes = acctRes;
    if (params.knownDeviceId) {
      const devKey = `${params.knownDeviceId}:${params.accountHmac}`;
      const existingDev = readAttemptRow("device_account", devKey);
      effectiveRes = applyAccountFailureToRow(
        existingDev,
        "device_account",
        devKey,
        nowMs,
        cfg.accountFailThreshold,
        accountWindowMs,
        decayMs,
        cfg.lockoutStepsSeconds
      );
    }

    // 2. Atualiza par (IP, conta)
    const existingPair = readAttemptRow("pair", pairKey);
    applyAccountFailureToRow(
      existingPair,
      "pair",
      pairKey,
      nowMs,
      cfg.pairFailThreshold,
      pairWindowMs,
      decayMs,
      cfg.lockoutStepsSeconds
    );

    // 3. Atualiza IP (no modo ataque reduz o limite de IP pela metade)
    const effectiveIpThreshold = attackModeActive
      ? Math.max(2, Math.floor(cfg.ipFailThreshold / 2))
      : cfg.ipFailThreshold;
    const existingIp = readAttemptRow("ip", ipKey);
    const ipRes = applyAccountFailureToRow(
      existingIp,
      "ip",
      ipKey,
      nowMs,
      effectiveIpThreshold,
      ipWindowMs,
      decayMs,
      [300, 900, 1800, 3600]
    );

    // 4. Detecção de Modo Ataque (muitas contas distintas falhando a partir de poucos IPs)
    const attackWindowCutoff = nowMs - cfg.attackModeWindowSeconds * 1000;
    let distinctAccounts = 0;
    let distinctIps = 0;

    if (db) {
      db.prepare(`DELETE FROM auth_attack_events WHERE created_at_ms < ?`).run(
        attackWindowCutoff
      );
      db.prepare(
        `INSERT INTO auth_attack_events (ip_key, account_hmac, created_at_ms) VALUES (?, ?, ?)`
      ).run(ipKey, params.accountHmac, nowMs);

      const stats = db
        .prepare(
          `SELECT COUNT(DISTINCT account_hmac) AS distinct_accounts,
                  COUNT(DISTINCT ip_key) AS distinct_ips
           FROM auth_attack_events
           WHERE created_at_ms >= ?`
        )
        .get(attackWindowCutoff) as
        { distinct_accounts?: number; distinct_ips?: number } | undefined;

      distinctAccounts = Number(stats?.distinct_accounts ?? 0);
      distinctIps = Number(stats?.distinct_ips ?? 0);
    } else {
      for (let i = memAttackEvents.length - 1; i >= 0; i--) {
        if ((memAttackEvents[i]?.created_at_ms ?? 0) < attackWindowCutoff) {
          memAttackEvents.splice(i, 1);
        }
      }
      memAttackEvents.push({
        ip_key: ipKey,
        account_hmac: params.accountHmac,
        created_at_ms: nowMs,
      });
      distinctAccounts = new Set(memAttackEvents.map((e) => e.account_hmac))
        .size;
      distinctIps = new Set(memAttackEvents.map((e) => e.ip_key)).size;

      const d1 = getCloudflareD1Binding();
      if (d1) {
        void d1
          .prepare(
            `INSERT INTO auth_attack_events (ip_key, account_hmac, created_at_ms) VALUES (?, ?, ?)`
          )
          .bind(ipKey, params.accountHmac, nowMs)
          .run()
          .catch(() => {});
      }
    }

    // Dispara Modo Ataque se >= N contas distintas falharam em poucos IPs (ou média >= 2 contas por IP com >= N contas)
    if (
      distinctAccounts >= cfg.attackModeDistinctAccounts &&
      (distinctIps <= cfg.attackModeMaxIps ||
        distinctAccounts >= distinctIps * 2)
    ) {
      const nextUntil = nowMs + cfg.attackModeDurationSeconds * 1000;
      if (!attackModeActive) {
        attackModeTriggeredNow = true;
      }
      attackUntilMs = Math.max(attackUntilMs, nextUntil);
      attackModeActive = true;
      writeAttackModeUntilMs(attackUntilMs, nowMs);
    }

    return {
      accountFailures: effectiveRes.row.consecutive_failures,
      accountLockoutStarted: effectiveRes.lockoutStarted,
      accountLockoutLevel: effectiveRes.row.lockout_level,
      accountRetryAfterSeconds: effectiveRes.retryAfterSeconds,
      accountWasAlreadyLocked: effectiveRes.wasAlreadyLocked,
      shouldSendLockoutAlert: acctRes.shouldSendAlert,
      ipFailures: ipRes.row.consecutive_failures,
      ipLocked: ipRes.lockoutStarted || ipRes.wasAlreadyLocked,
      attackModeTriggeredNow,
      attackModeActive,
    };
  });
}

/**
 * Zera os contadores de falha e nível de bloqueio após login bem-sucedido.
 */
export function recordAuthSuccessAtomic(params: {
  accountHmac: string;
  clientIp: string;
  knownDeviceId?: string | null;
  nowMs?: number;
}): void {
  const nowMs = params.nowMs ?? Date.now();
  const ipKey = normalizeClientIp(params.clientIp);
  const pairKey = `${ipKey}:${params.accountHmac}`;

  runImmediateTx(() => {
    const scopes: Array<[ThrottleScopeType, string]> = [
      ["account", params.accountHmac],
      ["pair", pairKey],
    ];
    if (params.knownDeviceId) {
      scopes.push([
        "device_account",
        `${params.knownDeviceId}:${params.accountHmac}`,
      ]);
    }
    for (const [scopeType, scopeKey] of scopes) {
      const existing = readAttemptRow(scopeType, scopeKey);
      upsertAttemptRow({
        scope_type: scopeType,
        scope_key: scopeKey,
        consecutive_failures: 0,
        window_started_at_ms: 0,
        locked_until_ms: 0,
        lockout_level: 0,
        last_failure_at_ms: 0,
        last_success_at_ms: nowMs,
        alert_sent_at_ms: existing?.alert_sent_at_ms ?? 0,
        updated_at_ms: nowMs,
      });
    }
  });
}

/**
 * Desbloqueio operacional manual de uma conta (aceita e-mail em claro ou HMAC já calculado).
 */
export function unlockAccountManually(emailOrHmac: string): {
  accountHmac: string;
  rowsCleared: number;
} {
  const accountHmac = /^[a-f0-9]{64}$/i.test(emailOrHmac.trim())
    ? emailOrHmac.trim().toLowerCase()
    : computeAccountHmac(emailOrHmac);

  const rowsCleared = runImmediateTx(() => {
    const db = getTestSqliteDatabase();
    if (!db) {
      let cleared = 0;
      for (const [k, row] of memAttempts.entries()) {
        if (
          row.scope_key === accountHmac ||
          row.scope_key.endsWith(`:${accountHmac}`)
        ) {
          memAttempts.delete(k);
          cleared += 1;
        }
      }
      const d1 = getCloudflareD1Binding();
      if (d1) {
        void d1
          .prepare(
            `DELETE FROM auth_login_attempts WHERE scope_key = ? OR scope_key LIKE ?`
          )
          .bind(accountHmac, `%:${accountHmac}`)
          .run()
          .catch(() => {});
      }
      return cleared;
    }
    const r1 = db
      .prepare(
        `DELETE FROM auth_login_attempts WHERE scope_key = ? OR scope_key LIKE ?`
      )
      .run(accountHmac, `%:${accountHmac}`);
    return Number(r1.changes ?? 0);
  });

  return { accountHmac, rowsCleared };
}

export function getAccountAttemptState(accountHmac: string): AttemptRow | null {
  return readAttemptRow("account", accountHmac);
}

export function isAttackModeActive(nowMs = Date.now()): boolean {
  return readAttackModeUntilMs() > nowMs;
}

const accountMutexChains = new Map<string, Promise<unknown>>();

/**
 * Serializa verificações concorrentes para a MESMA conta (`accountHmac`),
 * eliminando condições de corrida TOCTOU (ex.: 100 tentativas paralelas de
 * adivinhação de senha na mesma conta antes da 3ª falha gravar o bloqueio).
 * Contas diferentes continuam executando 100% em paralelo.
 */
export async function withAccountAuthLock<T>(
  accountHmac: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = accountMutexChains.get(accountHmac) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => current);
  accountMutexChains.set(accountHmac, tail);

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (accountMutexChains.get(accountHmac) === tail) {
      accountMutexChains.delete(accountHmac);
    }
  }
}

export function resetAllAuthThrottleStateForTests(): void {
  memAttempts.clear();
  memAttackEvents.length = 0;
  memAttackModeUntilMs = 0;
  runImmediateTx(() => {
    const db = getTestSqliteDatabase();
    if (!db) return;
    db.exec(`
      DELETE FROM auth_login_attempts;
      DELETE FROM auth_attack_events;
      DELETE FROM auth_security_state;
      DELETE FROM auth_secrets;
    `);
  });
}

// =============================================================================
// Armazenamento de segredos próprios (códigos de recuperação e OTP/link mágico)
// =============================================================================

export type AuthSecretPurpose = "password_reset" | "magic_link_otp";

export async function issueOneTimeAuthSecret(params: {
  purpose: AuthSecretPurpose;
  accountHmac: string;
  userId: string;
  ttlMs: number;
  nowMs?: number;
}): Promise<{ id: string; rawSecret: string; secretHash: string }> {
  const nowMs = params.nowMs ?? Date.now();
  const rawSecret = crypto.randomBytes(24).toString("hex");
  const secretHash = await hashAppSecretArgon2id(rawSecret);
  const id = `${params.purpose}-${crypto.randomUUID()}`;

  const d1 = getD1Database();
  await d1.batch([
    d1.prepare(`DELETE FROM auth_secrets WHERE expires_at_ms <= ?`).bind(nowMs),
    d1
      .prepare(
        `DELETE FROM auth_secrets WHERE purpose = ? AND account_hmac = ?`
      )
      .bind(params.purpose, params.accountHmac),
    d1
      .prepare(
        `INSERT INTO auth_secrets (id, purpose, account_hmac, user_id, secret_hash, expires_at_ms, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        params.purpose,
        params.accountHmac,
        params.userId,
        secretHash,
        nowMs + params.ttlMs,
        nowMs
      ),
  ]);

  return { id, rawSecret, secretHash };
}

/**
 * Valida e consome atomicamente um segredo de uso único (reset ou OTP) em tempo constante.
 */
export async function consumeOneTimeAuthSecret(params: {
  purpose: AuthSecretPurpose;
  accountHmac: string;
  rawSecret: string;
  nowMs?: number;
}): Promise<{ valid: boolean; userId?: string }> {
  const nowMs = params.nowMs ?? Date.now();
  const d1 = getD1Database();

  const { results: candidates } = await d1
    .prepare(
      `SELECT id, user_id, secret_hash, expires_at_ms
       FROM auth_secrets
       WHERE purpose = ? AND account_hmac = ? AND expires_at_ms > ?`
    )
    .bind(params.purpose, params.accountHmac, nowMs)
    .all<{
      id: string;
      user_id: string;
      secret_hash: string;
      expires_at_ms: number;
    }>();

  if (candidates.length === 0) {
    // Executa verificação dummy para evitar timing leak quando não há token ativo
    await hashAppSecretArgon2id(params.rawSecret.slice(0, 64) || "dummy-token");
    return { valid: false };
  }

  for (const row of candidates) {
    const matches = await verifyAppSecretArgon2id(
      params.rawSecret.trim(),
      row.secret_hash
    );
    if (matches) {
      const res = await d1
        .prepare(`DELETE FROM auth_secrets WHERE id = ?`)
        .bind(row.id)
        .run();
      const deleted = Number(res.meta?.changes ?? 0);
      if (deleted === 1) {
        return { valid: true, userId: row.user_id };
      }
    }
  }

  return { valid: false };
}
