# SECURITY-AUTH.md — Arquitetura e Operação de Segurança de Autenticação do ReadingFlow

Este documento registra as decisões de arquitetura, proteções contra _credential stuffing_ e enumeração de contas, política de senhas, armazenamento de segredos, auditoria de logs, procedimentos operacionais, propostas futuras (não implementadas) e riscos residuais da camada de autenticação do **ReadingFlow**.

---

## 1. Arquitetura e Fluxo de Autenticação

- **Login exclusivamente pelo servidor:** Nenhum formulário ou script no navegador envia credenciais diretamente ao Supabase Auth. Todas as operações de autenticação passam por Server Actions (`"use server"` em `src/features/auth/actions.ts`) e rotas HTTP `POST` dedicadas (`/api/auth/login`, `/api/auth/signup`, `/api/auth/password-reset`, `/api/auth/magic-link`, `/api/auth/change-password`).
- **CSP e transporte:** A `Content-Security-Policy` (`next.config.ts`) restringe `connect-src 'self'`. Senhas jamais são aceitas em URL ou query string (somente corpo `POST`). Todas as respostas HTTP de autenticação emitem `Cache-Control: no-store, max-age=0` e `X-Content-Type-Options: nosniff`.
- **Rede de proteção no Supabase (Etapa 2):**
  - Migração canônica de dados por usuário em `supabase/migrations/20261122000000_user_data_rls_cover_lock_and_settings.sql` garantindo em todas as tabelas (`profiles`, `works`, `editions`, `shelves`, `library_items`, `shelf_books`, `readings`, `reviews`, `goals`, `wishlist`, `user_settings`): `user_id uuid not null default auth.uid()` com FK `REFERENCES auth.users(id) ON DELETE CASCADE`, **RLS ligada e forçada**, políticas `USING (user_id = (select auth.uid()))` / `WITH CHECK (user_id = (select auth.uid()))`, índice em `user_id`, FK composta `(book_id, user_id)` e `(shelf_id, user_id)` em `shelf_books` (e `(edition_id, user_id)` em `library_items`), `user_settings` com 1 linha por usuário e trigger de proteção para `cover_locked = true`. Teste SQL de isolamento A/B em `supabase/tests/rls_two_users_isolation.sql`.
  - Migração de segurança de login em `supabase/migrations/20261121210000_auth_security_lockout_and_hook.sql` cria as tabelas `private.auth_login_attempts` e `private.auth_attack_events` com **RLS ligada e forçada**, revogação total para `PUBLIC`, `anon` e `authenticated`, funções `SECURITY DEFINER` com `SET search_path = ''` e row-level lock (`FOR UPDATE`), e o **Password Verification Hook** (`public.hook_password_verification_attempt`, concedido exclusivamente a `supabase_auth_admin`).
  - `supabase/config.toml` configura `minimum_password_length = 12`, `enable_confirmations = true`, `secure_password_change = true`, `[auth.captcha]` (`turnstile`) e `[auth.hook.password_verification_attempt]`.

---

## 2. Armazenamento de Senhas e Segredos (bcrypt × Argon2id)

### 2.1 Senhas de Usuário

- **Supabase Auth (produção/Etapa 2):** O Supabase GoTrue armazena hashes de senha exclusivamente com **bcrypt** (não é possível trocar para Argon2id sem substituir a camada de autenticação). **Regra:** nunca re-hashear senhas no app antes de enviar ao Supabase Auth; nenhuma tabela própria do app persiste nem loga senhas quando o Supabase Auth estiver ativo.
- **Limite de 72 bytes UTF-8:** O algoritmo bcrypt trunca entradas acima de **72 bytes**. Como caracteres acentuados e emojis em UTF-8 ocupam de 2 a 4 bytes, o ReadingFlow valida `getUtf8ByteLength(password) <= 72` tanto no cliente quanto no servidor (`src/features/auth/rules.ts` e `src/features/auth/schema.ts`), impedindo truncamento silencioso.
- **Camada local atual (antes da ativação da Etapa 2 do Supabase):** Enquanto o adaptador local SQLite (`ADR-0004` / `ADR-0005`) está ativo, as senhas usam `crypto.scrypt` assíncrono (`src/server/security/password.ts`) com sal aleatório de 16 bytes e chave derivada de 64 bytes (`timingSafeEqual`).

### 2.2 Segredos Próprios do App (Códigos de Recuperação, OTP / Link Mágico, Chaves)

- Armazenados em `auth_secrets` usando **Argon2id nativo** do Node.js (`node:crypto` — `src/server/security/secrets.ts`), formato PHC (`$argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>`), sal aleatório de 16 bytes por segredo e verificação em tempo constante (`crypto.timingSafeEqual`).
- **Conformidade OWASP Password Storage Cheat Sheet:**
  - Piso mínimo rígido imposto em código: `m >= 19.456 KiB` (19 MiB), `t >= 2`, `p >= 1`.
  - Calibração padrão em servidor (~225–250 ms nesta referência de hardware): `m = 65.536 KiB` (64 MiB), `t = 6`, `p = 1`.
  - Todos os parâmetros são configuráveis por variáveis de ambiente (`AUTH_ARGON2_*`) para endurecimento progressivo futuro sem quebrar segredos em trânsito.

### 2.3 Política de Senhas e Proteção Contra Vazamentos

- **Mínimo de 12 caracteres**, sem regras artificiais de composição (aceita espaços e Unicode completo até 72 bytes UTF-8 — alinhado ao NIST SP 800-63B).
- **Bloqueio de senhas comuns e triviais:** lista curada (PT-BR/EN) + rejeição de repetições e sequências lineares.
- **Senhas vazadas (HIBP k-anonymity):** No cadastro, redefinição e troca de senha, `checkPwnedPasswordServer` (`src/server/security/pwned-passwords.ts`) envia **somente os 5 primeiros hexadecimais do SHA-1** para `api.pwnedpasswords.com/range/{prefix}` com `Add-Padding: true` (executado apenas no servidor; jamais expõe a senha). No Supabase em nuvem, ativar também a _Leaked Password Protection_ nativa quando em plano Pro ou superior.
- **Troca de senha autenticado (`changePasswordAction` / `POST /api/auth/change-password`):** Exige senha atual ou sessão recente (`<= 15 min`), encerra todas as **outras** sessões ativas do usuário e despacha aviso de segurança por e-mail ao titular.

---

## 3. Anti-Enumeração, Tempo Equalizado e Limites Atômicos

### 3.1 Respostas Uniformes

| Fluxo                                                                 | Resposta Uniforme                                                                                                           | Comportamento Especial                                                                                                                                                                                                                                                                               |
| :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login — e-mail inexistente, senha errada ou e-mail não confirmado** | HTTP `401` · `{ "ok": false, "error": "E-mail ou senha incorretos." }`                                                      | Executa derivação dummy para e-mails inexistentes + tempo mínimo equalizado (`>= 600 ms` + jitter). Se a senha estiver correta mas o e-mail não estiver confirmado, retorna a **mesma** mensagem `401` e reenvia a confirmação em segundo plano com limite de taxa (1 envio a cada 120 s por conta). |
| **Bloqueio (conta, IP ou par)**                                       | HTTP `429` + header `Retry-After` · `{ "ok": false, "error": "Muitas tentativas. Tente novamente em instantes." }`          | Comporta-se **igualmente** para e-mails existentes e inexistentes.                                                                                                                                                                                                                                   |
| **Cadastro, Recuperação de Senha e Link Mágico/OTP**                  | HTTP `200` (sem `Set-Cookie` no endpoint HTTP) · `{ "ok": true, "message": "Se o e-mail existir, enviaremos instruções." }` | Tempo equalizado + derivação dummy quando a conta não existe (ou já existe no cadastro).                                                                                                                                                                                                             |

### 3.2 Limites Atômicos (Conta, IP, Par, Modo Ataque e Dispositivo Conhecido)

- **Identificador sem PII:** E-mail normalizado (`trim` + minúsculas + Unicode `NFKC`) → `HMAC-SHA256(AUTH_HMAC_SECRET, "account:" + email)`. A tabela de tentativas **nunca** armazena e-mail em claro.
- **Por conta:** **3 falhas consecutivas** em uma janela de **15 min** → bloqueio de **60 s**. Reincidência escala: `60 s → 5 min (300 s) → 15 min (900 s) → 1 h (3.600 s, teto)`, retornando ao nível inicial após login bem-sucedido ou **24 h** sem falhas. Tentativas durante o bloqueio **não estendem** o tempo nem contam como nova falha.
- **Por IP e par `(IP, conta)`:** 10 falhas em 5 min por IP (**IPv6 agrupado por `/64`**) e 3 falhas por par `(IP, conta)`. O IP só é lido de headers de proxy confiável (`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`) quando `AUTH_TRUST_PROXY=1`.
- **Modo ataque:** Se `>= 8` contas distintas falharem em 5 min a partir de poucos IPs, ativa o Modo Ataque por 10 min, exigindo CAPTCHA para todas as tentativas e reduzindo o limite de IP pela metade.
- **Mitigação de bloqueio malicioso (DoS contra a vítima):**
  1. No 1º bloqueio de uma conta existente, envia e-mail de alerta ao titular (sem revelar na resposta HTTP).
  2. Dispositivos desconhecidos enfrentam um degrau de CAPTCHA (Turnstile/hCaptcha) após 2 falhas antes do bloqueio duro.
  3. Dispositivos legítimos recebem cookie assinado `rf_known_device` (`HttpOnly`, `Secure` em produção, `SameSite=Lax`, validade 90 dias) com contador isolado (`device_account`), evitando que ataques externos bloqueiem o dispositivo já conhecido do usuário.
- **Atomicidade:** No SQLite local, todas as atualizações rodam em transação `BEGIN IMMEDIATE ... COMMIT` (`src/server/security/auth-throttle.ts`). No Postgres/Supabase, rodam via `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` (`private.record_auth_failure`).

---

## 4. Variáveis de Ambiente Configuráveis

| Variável                             | Padrão                                       | Descrição                                                                                  |
| :----------------------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `AUTH_HMAC_SECRET`                   | _(obrigatório em prod, ≥ 32 chars)_          | Segredo server-only do HMAC-SHA256 de contas e logs. Nunca prefixar com `NEXT_PUBLIC_`.    |
| `AUTH_DEVICE_COOKIE_SECRET`          | _(derivado de `AUTH_HMAC_SECRET`)_           | Chave HMAC do cookie assinado `rf_known_device`.                                           |
| `AUTH_TRUST_PROXY`                   | `0`                                          | Ative (`1`) somente atrás de proxy reverso confiável (Cloudflare/Vercel/Nginx gerenciado). |
| `AUTH_TRUSTED_PROXY_HEADERS`         | `cf-connecting-ip,x-real-ip,x-forwarded-for` | Ordem de precedência dos headers de IP confiáveis.                                         |
| `AUTH_MIN_RESPONSE_MS`               | `600`                                        | Tempo mínimo equalizado de resposta (ms) nas operações de auth.                            |
| `AUTH_RESPONSE_JITTER_MS`            | `80`                                         | Jitter aleatório máximo (ms) somado ao tempo mínimo.                                       |
| `AUTH_ACCOUNT_FAIL_THRESHOLD`        | `3`                                          | Falhas consecutivas por conta para iniciar bloqueio.                                       |
| `AUTH_ACCOUNT_WINDOW_SEC`            | `900`                                        | Janela (segundos) das falhas consecutivas por conta (15 min).                              |
| `AUTH_LOCKOUT_STEPS_SEC`             | `60,300,900,3600`                            | Escalonamento progressivo do bloqueio (teto de 1 h).                                       |
| `AUTH_LOCKOUT_DECAY_HOURS`           | `24`                                         | Horas sem falhas para resetar o nível de reincidência.                                     |
| `AUTH_IP_FAIL_THRESHOLD`             | `10`                                         | Falhas por IP na janela de `AUTH_IP_WINDOW_SEC` (cai pela metade no Modo Ataque).          |
| `AUTH_IP_WINDOW_SEC`                 | `300`                                        | Janela (segundos) do limite por IP (5 min).                                                |
| `AUTH_PAIR_FAIL_THRESHOLD`           | `3`                                          | Falhas por par `(IP, conta)`.                                                              |
| `AUTH_PAIR_WINDOW_SEC`               | `900`                                        | Janela (segundos) do par `(IP, conta)`.                                                    |
| `AUTH_ATTACK_MODE_DISTINCT_ACCOUNTS` | `8`                                          | Contas distintas falhando na janela para acionar Modo Ataque.                              |
| `AUTH_ATTACK_MODE_MAX_IPS`           | `5`                                          | Número máximo de IPs distintos para caracterizar rajada concentrada.                       |
| `AUTH_ATTACK_MODE_WINDOW_SEC`        | `300`                                        | Janela (segundos) de observação do Modo Ataque.                                            |
| `AUTH_ATTACK_MODE_DURATION_SEC`      | `600`                                        | Duração (segundos) do Modo Ataque após acionamento.                                        |
| `AUTH_CAPTCHA_PROVIDER`              | `none` (`turnstile` / `hcaptcha` / `mock`)   | Provedor CAPTCHA verificado no servidor.                                                   |
| `AUTH_CAPTCHA_SECRET_KEY`            | _(vazio)_                                    | Chave secreta do provedor Turnstile/hCaptcha (somente servidor).                           |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY`       | _(vazio)_                                    | Site key pública do widget CAPTCHA no navegador.                                           |
| `AUTH_CAPTCHA_STEP_BEFORE_LOCKOUT`   | `2`                                          | Falhas em dispositivo desconhecido antes de exigir CAPTCHA.                                |
| `AUTH_HIBP_CHECK_ENABLED`            | `true` (`false` em Vitest)                   | Liga/desliga checagem k-anonymity no Pwned Passwords.                                      |
| `AUTH_HIBP_TIMEOUT_MS`               | `2500`                                       | Timeout (ms) da consulta HIBP no servidor.                                                 |
| `AUTH_ARGON2_MEMORY_KIB`             | `65536` (mín. `19456`)                       | Memória do Argon2id em KiB (64 MiB em prod).                                               |
| `AUTH_ARGON2_PASSES`                 | `6` (mín. `2`)                               | Número de iterações (`t`) do Argon2id (~225–250 ms).                                       |
| `AUTH_ARGON2_PARALLELISM`            | `1` (mín. `1`)                               | Paralelismo (`p`) do Argon2id.                                                             |
| `AUTH_REQUIRE_EMAIL_CONFIRMATION`    | `false` (`true` em staging/prod)             | Exige confirmação de e-mail antes do primeiro login.                                       |
| `AUTH_LOG_RETENTION_DAYS`            | `90`                                         | Retenção máxima de logs com `ip_hash` e `ua_summary` (LGPD).                               |

---

## 5. Procedimentos Operacionais

### 5.1 Desbloquear uma conta manualmente

1. **Calcular o HMAC-SHA256 da conta** (nunca pesquisar por e-mail em claro no banco):
   ```bash
   node -e "const c=require('node:crypto'); const email=process.argv[1].normalize('NFKC').trim().toLowerCase(); console.log(c.createHmac('sha256', process.env.AUTH_HMAC_SECRET).update('account:'+email).digest('hex'));" "usuario@exemplo.com"
   ```
2. **No Supabase (PostgreSQL — via SQL Editor com `service_role`):**
   ```sql
   SELECT private.unlock_auth_account('<ACCOUNT_HMAC_64_HEX>');
   -- Para verificar se também houve bloqueio pelo Password Verification Hook (por user_id):
   SELECT private.reset_auth_attempt('account', 'uid:<UUID_DO_USUARIO>');
   ```
3. **No ambiente local SQLite:**
   ```bash
   node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('./.data/readingflow.sqlite'); const h = process.argv[1]; console.log(db.prepare('DELETE FROM auth_login_attempts WHERE scope_key = ? OR scope_key LIKE ?').run(h, '%:'+h));" "<ACCOUNT_HMAC_64_HEX>"
   ```
4. Registrar o desbloqueio operacional com `logAuthEvent({ event: "account_unlocked", accountHmac, internalReason: "manual_ops_unlock" })`.

### 5.2 Consultar os logs estruturados e métricas de alerta

Todos os eventos saem em JSON linha-a-linha no `stdout` com `service: "readingflow-auth"`, `account_hash` (prefixo HMAC), `ip_hash` (HMAC), **`ip_truncated`** (IPv4 `/24` ou IPv6 `/64`, sem IP completo), redação automática de campos sensíveis (`password`, `token`, `authorization`, `cookie`, `apikey`, `email`, `body`) e retenção configurada para **90 dias** (alinhada à Política de Privacidade e LGPD).

- **Filtrar bloqueios e Modo Ataque (ex.: `jq` / agregador de logs):**
  ```bash
  jq 'select(.service == "readingflow-auth" and (.event == "lockout_started" or .event == "attack_mode_triggered" or .event == "captcha_failed"))' auth.log
  ```
- **Investigar incidentes de uma conta específica pelo prefixo de 16 caracteres do HMAC:**
  ```bash
  jq --arg h "${ACCOUNT_HMAC:0:16}" 'select(.account_hash == $h) | {timestamp, event, ip_hash, ua_summary, internal_reason, request_id}' auth.log
  ```
- **Alerta de taxa de falhas:** Monitorar `getAuthFailuresPerMinute()` ou agregar `count(event IN ("login_failed", "lockout_blocked", "captcha_failed"))` em janelas de 1 minuto; disparar alerta de severidade média acima de 30 falhas/min e alta acima de 100 falhas/min.

---

## 6. Propostas Futuras (Não Implementadas Agora)

### 6.1 Proposta: Substituir bcrypt por Argon2id na camada principal de autenticação

- **Por que não fazer agora:** O Supabase Auth (GoTrue) gerencia internamente `auth.users` com bcrypt e emite os JWTs assinados lidos pelo PostgREST (`auth.uid()` nas políticas RLS) e pelo Supabase Storage.
- **Se houver exigência formal de conformidade por Argon2id em senhas de login:**
  - **Abordagem:** Adotar um provedor de identidade dedicado (ex.: Lucia/Better Auth/Auth.js self-hosted com Argon2id em tabela privada) emitindo JWTs compatíveis com a `JWT_SECRET` do Supabase (ou migrar fora do Supabase Auth).
  - **Custo estimado:** 2 a 4 semanas de engenharia + manutenção contínua de fluxos de e-mail, rotação de refresh tokens, OAuth e auditoria de segurança.
  - **Riscos e impacto em RLS/Storage:** Qualquer divergência nos claims do JWT (`sub`, `role: "authenticated"`, `aud`, `exp`) quebra imediatamente `auth.uid()` em todas as políticas RLS das tabelas do acervo e nos buckets privados `covers`/`avatars` do Storage; também se perde o gerenciamento automático de sessões, revogação e hooks nativos do GoTrue.

### 6.2 Proposta: MFA (TOTP) opcional para usuários

- **Escopo:** Autenticação em dois fatores via aplicativo autenticador (RFC 6238 TOTP) ativável em `/configuracoes`, com 8 códigos de recuperação de uso único armazenados com **Argon2id** (`auth_secrets`), passo de verificação pós-senha (`/entrar` etapa 2) e revogação de sessões ao ativar/desativar.
- **Integração com Supabase Auth (Etapa 2):** O Supabase Auth já possui API nativa `supabase.auth.mfa.enroll({ factorType: 'totp' })`, `challenge` e `verify`, elevando o nível da sessão para `aal2` (verificável em políticas RLS críticas).
- **Esforço estimado:** 3 a 5 dias de engenharia (1 dia backend/códigos de recuperação + 2 dias UI acessível em `/configuracoes` e `/entrar` + 1–2 dias testes E2E/segurança).

---

## 7. Limitações de Plano e Riscos Residuais

1. **Chamadas diretas à API do Supabase Auth (`POST /auth/v1/token`):**
   - O `Password Verification Hook` só é invocado pelo GoTrue para **usuários existentes** em `auth.users`. Portanto, se um atacante contornar o app e chamar a URL pública do Supabase Auth diretamente com um token de CAPTCHA válido, a diferença entre `Hook rejected` (conta existente bloqueada) e resposta padrão para conta inexistente ainda pode revelar existência da conta. **Mitigação:** exigir CAPTCHA obrigatório diretamente no `[auth.captcha]` do Supabase Auth + manter a URL/anon key exposta apenas onde indispensável e todas as ações de login concentradas no servidor.
2. **Limitações de plano do Supabase hospedado:**
   - Na nuvem do Supabase, **Leaked Password Protection (HIBP nativo)** e **Auth Hooks avançados / limites customizados** requerem plano **Pro** ou superior. Como compensação independente de plano, o ReadingFlow executa a verificação **HIBP k-anonymity** e o **bloqueio atômico completo** diretamente na camada de servidor do Next.js.
3. **Falha aberta (fail-open) na consulta HIBP:**
   - Em caso de indisponibilidade/timeout da API pública `api.pwnedpasswords.com` (`> 2,5 s`), o cadastro/troca de senha mantém a validação local (12+ chars, 72 bytes, lista de senhas comuns) e não bloqueia o usuário legítimo, registrando a indisponibilidade em log interno.
4. **Concorrência multi-instância antes da Etapa 2:**
   - No modo local atual (SQLite single-node), `BEGIN IMMEDIATE` garante atomicidade total entre requisições concorrentes do mesmo servidor. Ao escalar para múltiplas instâncias serverless (Vercel/Cloudflare), a Etapa 2 deve direcionar `auth-throttle.ts` às funções SQL atômicas `private.record_auth_failure` / `private.reset_auth_attempt` da migração `20261121210000_auth_security_lockout_and_hook.sql` (ou Redis/Upstash com Lua script atômico).

---

## 8. Auditoria de Dados por Usuário (Onde Cada Dado Vive)

| Dado / Entidade                                                                    | Armazenamento Canônico                                                                                   |                              Possui `user_id`?                               | Isolamento / Política                                                                         |
| :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------- |
| Perfil e preferências básicas (`profiles`)                                         | Banco (`public.profiles` / SQLite `users`)                                                               |                Sim (`user_id = id`, FK `auth.users` cascata)                 | RLS `(select auth.uid())`, 1 linha por usuário                                                |
| Obras e Edições (`works`, `editions`)                                              | Banco (`public.works`, `public.editions` / SQLite)                                                       |                  Sim (`user_id` + índice + `cover_locked`)                   | RLS `(select auth.uid())`; capa travada imutável a backfill                                   |
| Estantes e Vínculos (`shelves`, `shelf_books`, `library_items`)                    | Banco (`public.shelves`, `shelf_books`, `library_items`)                                                 | Sim (`user_id` + FK composta `(book_id, user_id)` / `(edition_id, user_id)`) | RLS `(select auth.uid())`, impede vínculo cruzado entre contas                                |
| Leituras, Avaliações, Metas e Desejos (`readings`, `reviews`, `goals`, `wishlist`) | Banco (`public.*` / SQLite)                                                                              |                     Sim (`user_id` + índices compostos)                      | RLS `(select auth.uid())`, cascata na exclusão da conta                                       |
| Preferências de UI/Estante 3D/Áudio (`user_settings`)                              | Banco (`public.user_settings` / SQLite `user_settings`)                                                  |                   Sim (`user_id` PK, 1 linha por usuário)                    | RLS `(select auth.uid())`, sincronizado entre dispositivos                                    |
| Capas enviadas manualmente (`covers`)                                              | Storage privado `{user_id}/{book_id}/...` + rota `/api/covers/file/...`                                  |                           Sim (pasta `{user_id}`)                            | Bucket `public = false`, rota valida sessão (`401`/`403`) e `Cache-Control: private`          |
| Cache de consultas de acervo                                                       | Memória servidor (`workspaceQueryCache`)                                                                 |                           Sim (`${userId}:${key}`)                           | Invalidação individual por `userId`; zero cache público em rotas autenticadas                 |
| Sessão ativa de cronômetro e sons no Foco                                          | `localStorage` auxiliar escopado por `userId` (`rf_focus_session_v1:{userId}`, `rf_ambient_v1:{userId}`) |                            Sim (escopo `userId`)                             | Apenas recuperação local após F5; fonte da verdade persistida em `user_settings` e `readings` |
| Layout legado de estante (migração única)                                          | `localStorage` (`rf_shelf_layout_v1`)                                                                    |                           Removido após importação                           | Lido uma única vez para migração para `user_settings` e imediatamente apagado                 |
| Índice do fundo da Landing (`/`)                                                   | `sessionStorage` (`rf_hero_last_idx`)                                                                    |                      N/A (público, sem dados pessoais)                       | Apenas evita repetir a mesma foto de fundo na página pública `/`                              |
| Seed demonstrativo (`demo@readingflow.local`)                                      | Memória/SQLite **apenas em dev** (`isDemoSessionAllowed()`)                                              |                          Isolado em `DEMO_USER_ID`                           | Bloqueado em produção por padrão; conta nova sempre começa vazia                              |
