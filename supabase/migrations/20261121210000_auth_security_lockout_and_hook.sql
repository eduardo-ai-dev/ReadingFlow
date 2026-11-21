-- =============================================================================
-- ReadingFlow · Migração de Segurança de Autenticação (RLS + Lockout Atômico +
-- Password Verification Hook do Supabase Auth)
-- =============================================================================
-- Regras obrigatórias:
-- - A tabela de tentativas NUNCA armazena e-mail em claro (somente HMAC-SHA256).
-- - Schema `private` fora do expose do PostgREST; RLS ligada e forçada.
-- - ZERO acesso para `anon`, `authenticated` ou `PUBLIC`.
-- - Operações atômicas via UPSERT + row-level lock em transação SQL.
-- - Password Verification Hook aplica o mesmo critério (3 falhas em 15 min ->
--   60s -> 5m -> 15m -> 1h teto, sem estender durante bloqueio) contra chamadas
--   diretas à API do Supabase Auth.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role, supabase_auth_admin;

CREATE TABLE IF NOT EXISTS private.auth_login_attempts (
  scope_type TEXT NOT NULL CHECK (scope_type IN ('account', 'ip', 'pair', 'device_account')),
  scope_key TEXT NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  lockout_level INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  alert_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_type, scope_key)
);

CREATE TABLE IF NOT EXISTS private.auth_attack_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_key TEXT NOT NULL,
  account_hmac TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_auth_attack_events_created
  ON private.auth_attack_events (created_at DESC);

ALTER TABLE private.auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.auth_login_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE private.auth_attack_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.auth_attack_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.auth_login_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.auth_attack_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.auth_login_attempts TO service_role, supabase_auth_admin;
GRANT SELECT, INSERT, DELETE ON TABLE private.auth_attack_events TO service_role, supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Função atômica para registrar falha de credencial (UPSERT + lock de linha)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.record_auth_failure(
  p_scope_type TEXT,
  p_scope_key TEXT,
  p_threshold INTEGER DEFAULT 3,
  p_window_seconds INTEGER DEFAULT 900,
  p_decay_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  is_locked BOOLEAN,
  was_already_locked BOOLEAN,
  lockout_started BOOLEAN,
  lockout_level INTEGER,
  retry_after_seconds INTEGER,
  consecutive_failures INTEGER,
  should_send_alert BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_row private.auth_login_attempts%ROWTYPE;
  v_steps INTEGER[] := ARRAY[60, 300, 900, 3600];
  v_level INTEGER := 0;
  v_fails INTEGER := 0;
  v_win_start TIMESTAMPTZ := v_now;
  v_locked_until TIMESTAMPTZ := NULL;
  v_retry INTEGER := 0;
  v_started BOOLEAN := FALSE;
  v_send_alert BOOLEAN := FALSE;
  v_alert_sent TIMESTAMPTZ := NULL;
BEGIN
  -- Garante linha existente para adquirir row-level lock atômico sob concorrência
  INSERT INTO private.auth_login_attempts (scope_type, scope_key, window_started_at, updated_at)
  VALUES (p_scope_type, p_scope_key, v_now, v_now)
  ON CONFLICT (scope_type, scope_key) DO NOTHING;

  SELECT * INTO v_row
  FROM private.auth_login_attempts
  WHERE scope_type = p_scope_type AND scope_key = p_scope_key
  FOR UPDATE;

  -- Tentativas durante o bloqueio NÃO estendem o bloqueio nem contam como nova falha
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN QUERY SELECT
      TRUE,
      TRUE,
      FALSE,
      v_row.lockout_level,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.locked_until - v_now)))::INTEGER),
      v_row.consecutive_failures,
      FALSE;
    RETURN;
  END IF;

  v_level := v_row.lockout_level;
  IF v_row.last_failure_at IS NOT NULL
     AND v_now - v_row.last_failure_at >= make_interval(hours => p_decay_hours) THEN
    v_level := 0;
  END IF;

  v_fails := v_row.consecutive_failures;
  v_win_start := v_row.window_started_at;
  IF v_win_start IS NULL
     OR v_now - v_win_start > make_interval(secs => p_window_seconds) THEN
    v_fails := 0;
    v_win_start := v_now;
  END IF;

  v_fails := v_fails + 1;
  v_alert_sent := v_row.alert_sent_at;

  IF v_fails >= p_threshold THEN
    v_level := LEAST(array_length(v_steps, 1), v_level + 1);
    v_retry := v_steps[v_level];
    v_locked_until := v_now + make_interval(secs => v_retry);
    v_fails := 0;
    v_win_start := v_now;
    v_started := TRUE;

    IF p_scope_type = 'account' AND v_level = 1
       AND (v_alert_sent IS NULL OR v_now - v_alert_sent >= make_interval(hours => p_decay_hours)) THEN
      v_alert_sent := v_now;
      v_send_alert := TRUE;
    END IF;
  END IF;

  UPDATE private.auth_login_attempts
  SET
    consecutive_failures = v_fails,
    window_started_at = v_win_start,
    locked_until = v_locked_until,
    lockout_level = v_level,
    last_failure_at = v_now,
    alert_sent_at = v_alert_sent,
    updated_at = v_now
  WHERE scope_type = p_scope_type AND scope_key = p_scope_key;

  RETURN QUERY SELECT
    (v_locked_until IS NOT NULL AND v_locked_until > v_now),
    FALSE,
    v_started,
    v_level,
    v_retry,
    v_fails,
    v_send_alert;
END;
$$;

CREATE OR REPLACE FUNCTION private.reset_auth_attempt(
  p_scope_type TEXT,
  p_scope_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.auth_login_attempts
  SET
    consecutive_failures = 0,
    locked_until = NULL,
    lockout_level = 0,
    last_failure_at = NULL,
    last_success_at = now(),
    updated_at = now()
  WHERE scope_type = p_scope_type AND scope_key = p_scope_key;
END;
$$;

-- Desbloqueio operacional manual de uma conta (via service_role / SQL Editor)
CREATE OR REPLACE FUNCTION private.unlock_auth_account(
  p_account_hmac TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM private.auth_login_attempts
  WHERE scope_key = p_account_hmac OR scope_key LIKE ('%:' || p_account_hmac);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION private.record_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reset_auth_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.unlock_auth_account(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_auth_failure(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.reset_auth_attempt(TEXT, TEXT) TO service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.unlock_auth_account(TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- Rede de proteção no Supabase Auth: Password Verification Hook
-- Protege contra chamadas diretas à API do Supabase Auth (/auth/v1/token)
-- com a mesma política: 3 falhas em 15 min -> 60s -> 5m -> 15m -> 1h (teto).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hook_password_verification_attempt(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id TEXT := event ->> 'user_id';
  v_valid BOOLEAN := COALESCE((event ->> 'valid')::BOOLEAN, FALSE);
  v_scope_key TEXT := 'uid:' || COALESCE(v_user_id, 'unknown');
  v_existing private.auth_login_attempts%ROWTYPE;
  v_res RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  SELECT * INTO v_existing
  FROM private.auth_login_attempts
  WHERE scope_type = 'account' AND scope_key = v_scope_key;

  -- Já bloqueado: recusa sem estender bloqueio nem incrementar falha
  IF v_existing.locked_until IS NOT NULL AND v_existing.locked_until > now() THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Muitas tentativas. Tente novamente em instantes.'
    );
  END IF;

  IF v_valid THEN
    PERFORM private.reset_auth_attempt('account', v_scope_key);
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  SELECT * INTO v_res
  FROM private.record_auth_failure('account', v_scope_key, 3, 900, 24);

  IF v_res.is_locked THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Muitas tentativas. Tente novamente em instantes.'
    );
  END IF;

  RETURN jsonb_build_object('decision', 'continue');
END;
$$;

REVOKE ALL ON FUNCTION public.hook_password_verification_attempt(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_password_verification_attempt(JSONB) TO supabase_auth_admin;
