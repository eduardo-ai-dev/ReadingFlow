# Suíte de Teste de Estresse e Carga — ReadingFlow (`loadtest/`)

Suíte determinística para medir e validar o comportamento do **ReadingFlow** sob carga: logins simultâneos (até 100 VUs), navegação autenticada (50 VUs), mutações em rajada, 20 uploads concorrentes de capa, isolamento estrito entre usuários (RLS/sessão/cache), estantes com 500 a 2.000 livros no navegador (1× e 4× CPU slowdown), cliques em rajada, Modo Foco (50 ciclos) e monkey test com semente reproduzível.

---

## 1. Regras de Segurança (Obrigatórias)

1. **Nunca execute contra produção ou dados reais.**
2. Todo script (`seed.mjs`, `cleanup.mjs`, `mock-server.mjs`, `run-http-load.mjs`, `smoke.mjs`, `playwright.config.ts` e `k6/*.js`) executa a guarda [`loadtest/safety-guard.mjs`](./safety-guard.mjs), que:
   - Exige `LOADTEST_ALLOW=1` no ambiente (abortando imediatamente com código `!= 0` caso ausente).
   - Valida o hostname de `LOADTEST_BASE_URL` / `NEXT_PUBLIC_APP_URL` e de `NEXT_PUBLIC_SUPABASE_URL` contra a allowlist estrita (`localhost`, `127.0.0.1`, `::1`, `*.local`, `*.test`, ou `LOADTEST_STAGING_HOST` contendo `staging`/`loadtest`).
3. Apenas contas sintéticas `loadtest+N@example.test` são criadas ou removidas.
4. **Zero chamadas reais a terceiros:** quando `LOADTEST_ALLOW=1` e `MOCK_CATALOG_BASE_URL` estão ativos, todas as consultas a **Google Books**, **Open Library**, **Hardcover**, **Apple Books** e **BrasilAPI** são roteadas para [`loadtest/mock-server.mjs`](./mock-server.mjs) e qualquer chamada externa fora do mock é abortada.

---

## 2. Estrutura de Arquivos

| Arquivo                                  | Descrição                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safety-guard.mjs`                       | Guarda de allowlist (`LOADTEST_ALLOW=1`), validação de e-mail `loadtest+N@example.test` e coletor `HostTelemetrySampler` (CPU/RAM da máquina host).                                                                               |
| `mock-server.mjs`                        | Servidor HTTP falso local (`127.0.0.1:4110`) para Google Books, Open Library, Hardcover, Apple Books, BrasilAPI e imagens de capa WebP, com suporte aos modos `normal`, `429`, `timeout`, `empty` e `slow`.                       |
| `seed.mjs`                               | Gerador determinístico com PRNG semeado (`Mulberry32`, semente padrão `20261121`) para escalas `small` (20×500), `medium` (100×1000), `large` (50×2000) e `smoke` (10×500 + perfis 500/1000/2000), executando `ANALYZE` ao final. |
| `cleanup.mjs`                            | Remove todas as contas `loadtest+N@example.test`, sessões e arquivos temporários em `.loadtest-data/`.                                                                                                                            |
| `run-http-load.mjs`                      | Executor Node.js de alta concorrência equivalente aos cenários k6 (logins 1→50→100 VUs, navegação 50 VUs, rajadas de mutação + 20 uploads concorrentes, spike 10× e soak) com telemetria de CPU/RAM.                              |
| `k6/*.js`                                | Scripts para a CLI do k6 (`auth-ramp.js`, `authenticated-nav.js`, `mutations-burst.js`, `spike-and-soak.js`).                                                                                                                     |
| `playwright/scale-500-1000-2000.spec.ts` | Benchmark no Chromium com 500, 1.000 e 2.000 livros (1× e 4× CPU slowdown via CDP): FCP, hidratação, contagem de nós DOM, JS Heap, FPS de rolagem, INP de hover/filtro, windowing 2D e drag-and-drop.                             |
| `playwright/burst-and-monkey.spec.ts`    | Rajadas dirigidas (`+10 páginas` 100×, abas/filtros 200×, Modo Foco 50×), condições adversas (offline preservando input, HTTP 429 sem marcar "sem capa"), múltiplas abas e monkey test determinístico.                            |
| `smoke.mjs`                              | Orquestrador end-to-end rápido (~1 min) acionado por `npm run loadtest:smoke`.                                                                                                                                                    |

---

## 3. Como Executar

### 3.1 Regressão rápida (`~1 min`)

Gere o build de produção local e rode `loadtest:smoke`:

```powershell
# PowerShell (Windows)
npm run build
$env:LOADTEST_ALLOW="1"
npm run loadtest:smoke
```

```bash
# Bash (Linux / macOS)
npm run build
LOADTEST_ALLOW=1 npm run loadtest:smoke
```

### 3.2 Execução por etapas (Escalas Pequena, Média e Grande)

```powershell
$env:LOADTEST_ALLOW="1"

# 1. Subir o mock de APIs externas (porta 4110)
node loadtest/mock-server.mjs

# 2. Popular dados determinísticos (small = 20x500 | medium = 100x1000 | large = 50x2000)
node loadtest/seed.mjs --scale=small --with-browser-scales

# 3. Rodar carga HTTP e banco (ou k6 run loadtest/k6/auth-ramp.js)
node loadtest/run-http-load.mjs

# 4. Rodar testes de navegador em escala e monkey test (10 min com LOADTEST_MONKEY_SECONDS=600)
npx playwright test -c loadtest/playwright.config.ts

# 5. Limpar usuários de teste e artefatos temporários
npm run loadtest:cleanup
```
