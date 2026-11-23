# Configuração de Variáveis, Segredos e Bindings — Cloudflare Workers

Este documento lista **apenas os nomes e onde configurar** cada variável, segredo e binding do ReadingFlow na Cloudflare Workers (OpenNext + D1). **Nunca grave valores reais neste arquivo ou no repositório.**

## 1. Bindings (`wrangler.jsonc`)

| Binding  | Tipo          | Recurso             | Uso                                                                   |
| -------- | ------------- | ------------------- | --------------------------------------------------------------------- |
| `DB`     | D1 Database   | `readingflow-db`    | Banco relacional principal (único binding D1; nunca duplicar).        |
| `ASSETS` | Static Assets | `.open-next/assets` | Servir assets estáticos públicos e imagens da landing fora do Worker. |

## 2. Variáveis de Ambiente Públicas / Não Sensíveis (`wrangler.jsonc` → `vars` ou painel **Workers → Settings → Variables**)

| Nome                        | Onde configurar                     | Descrição                                                                                                                                                                    |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEMO_ENABLED`              | `wrangler.jsonc` (`vars`) ou painel | Chave de desligamento da demonstração somente leitura (`"true"` para habilitar, `"false"` para desativar imediatamente e ocultar o botão).                                   |
| `NEXT_PUBLIC_APP_URL`       | Build / painel (por ambiente)       | URL canônica pública do ambiente (ex.: `https://readingflow.<subdominio>.workers.dev`). Opcional — quando ausente, URLs derivam do host da requisição, nunca de `localhost`. |
| `ENABLE_APPLE_BOOKS_COVERS` | Opcional (`vars`)                   | Feature flag para incluir busca de capas na Apple iTunes (`"false"` por padrão).                                                                                             |
| `CATALOG_LOOKUP_TIMEOUT_MS` | Opcional (`vars`)                   | Timeout por provedor na busca de metadados/capas (padrão `4000`).                                                                                                            |
| `RATE_LIMIT_MAX_PER_MINUTE` | Opcional (`vars`)                   | Limite por minuto nas buscas de catálogo por usuário autenticado (padrão `60`).                                                                                              |

## 3. Segredos do Servidor (`wrangler secret put <NOME>` ou painel **Workers → Settings → Variables and Secrets → Secret**)

| Nome                   | Obrigatório                     | Comando                                        | Uso                                                                                                                                                                                                            |
| ---------------------- | ------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_HMAC_SECRET`     | **Sim** (≥ 32 chars aleatórios) | `npx wrangler secret put AUTH_HMAC_SECRET`     | Assinatura HMAC-SHA256 dos tokens de sessão (`sessions.token_hash`), do cookie da demonstração somente leitura (`rf_demo_session`), de identificadores de conta (`account_hmac`) e de dispositivos conhecidos. |
| `GOOGLE_BOOKS_API_KEY` | Recomendado                     | `npx wrangler secret put GOOGLE_BOOKS_API_KEY` | Chave server-side para busca de metadados e capas na Google Books API (nunca exposta ao cliente).                                                                                                              |
| `HARDCOVER_API_TOKEN`  | Opcional                        | `npx wrangler secret put HARDCOVER_API_TOKEN`  | Token GraphQL server-side para busca de capas na Hardcover API.                                                                                                                                                |
| `TURNSTILE_SECRET_KEY` | Opcional                        | `npx wrangler secret put TURNSTILE_SECRET_KEY` | Verificação server-side de CAPTCHA em modo ataque.                                                                                                                                                             |

## 4. Desenvolvimento local (`.dev.vars`)

- Crie `.dev.vars` na raiz para rodar `opennextjs-cloudflare preview` / `wrangler dev` localmente (arquivo ignorado pelo `.gitignore`, nunca versionado).
- Defina pelo menos `AUTH_HMAC_SECRET` com um valor local de 64 caracteres hex.

## 5. Ordem obrigatória no CI / Deploy

1. Aplicar migrações D1 antes do deploy do Worker:
   ```bash
   npx wrangler d1 migrations apply readingflow-db --remote
   ```
2. Gerar o bundle e publicar:
   ```bash
   npm run deploy
   ```
3. Verificar saúde do banco e schema após o deploy:
   ```bash
   curl -fsS https://<seu-worker>.workers.dev/api/health
   ```
   Deve retornar HTTP `200` com `"ok": true`, `"db": "d1"` e `"foreignKeys": true`.
