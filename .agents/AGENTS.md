# AGENTS.md: ReadingFlow

## Contexto

Biblioteca pessoal digital (livros físicos, e-books, audiobooks) com estantes 3D opcionais.
Individual, sem rede social. Fonte da verdade: PostgreSQL (Supabase). O 3D só apresenta dados.
Especificação completa: docs/produto/ (arquivo ReadingFlow_Especificacao_v2.md).
Onde a especificação diz "Projeto Biblioteca", leia ReadingFlow. A paleta antiga da seção 9.2
(creme, marrom e verde-água) foi substituída pela "Bordô Editorial"; os tokens novos
ficam em src/styles/ e valem mais que a especificação.
Escopo atual: R0 (2D, sem 3D). Backlog: seção 14 da especificação.

## Stack

Next.js (App Router) + React + TypeScript estrito; Tailwind; Zod; Supabase (Auth, Postgres, Storage).
3D (R1): React Three Fiber, carregado sob demanda, sem SSR.

## Regras obrigatórias

- Chaves privilegiadas só no servidor. Nunca no cliente, nunca no repositório.
- Acesso a dados por consultas parametrizadas ou ORM. Nunca concatenar SQL.
- Validar toda entrada no servidor com Zod.
- RLS em toda tabela, com teste. Todo registro do usuário tem user_id.
- Não usar user_metadata para autorização.
- Nunca confiar em user_id vindo do cliente.
- Não instalar pacote sem conferir que existe, é mantido e é necessário.
- Texto de usuário nunca vira HTML sem sanitização. Exportar CSV neutralizando = + - @.

## Supabase

- Migrações só pela Supabase CLI, em supabase/migrations (nome: AAAAMMDDHHMMSS_descricao.sql).
  Nunca alterar tabelas pelo painel.
- A chave service_role fica só em variável de ambiente do servidor (sem prefixo NEXT_PUBLIC).
  No navegador, apenas a chave pública (anon/publishable) e sempre com RLS.
- Usar @supabase/ssr para sessão no Next.js; validar o usuário no servidor com getUser().
- Buckets do Storage (capas, avatares) exigem políticas próprias, por pasta com o id do usuário.
- Gerar tipos TypeScript com supabase gen types após cada migração.

## Identidade visual

Paleta "Bordô Editorial" (biblioteca clássica: madeira, couro, charuto). Tokens de cor em
src/styles/ (claro e escuro). Todo par de cores precisa de contraste AA (4,5:1 no texto).

## Qualidade

- Mobile-first. Teclado e leitor de tela em tudo.
- Textos em pt-BR, externalizados. Datas no fuso do perfil do usuário.
- Regras de negócio em funções puras com teste (Vitest). Fluxos críticos com Playwright.
- Mudanças pequenas, uma por pull request, com migração versionada quando tocar o banco.

## Como trabalhar

- Antes de codar: reler os critérios de aceite da história.
- Em dúvida de produto ou de segurança, perguntar em vez de supor.
- Não adicionar funcionalidade fora do escopo atual.
- Registrar decisões relevantes em docs/adr/.

---

## Planejamento de Criação e Implementação — Release R0 (2D)

> **Status:** `CONCLUÍDO (SEM BANCO DE DADOS — AGUARDANDO ETAPA 2 SUPABASE)` — Release R0 (2D) implementado e verificado integralmente sem a Etapa 2 (Supabase/Postgres adiados; persistência isolada por sessão em `src/server/store/memory-repository.ts`, ADR-0004).

### 1. Decisões Arquiteturais Propostas para o R0 (Seções 6.3 e 18.2)

Estas recomendações guiam a criação inicial e serão registradas em `docs/adr/` na Etapa 1 após aprovação:

| ID       | Decisão                | Escolha proposta para o R0                                                                                     | Motivo                                                                                                                                                                                 |
| -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-01** | Acesso a dados         | `@supabase/ssr` + `supabase-js` com RLS + RPCs `security invoker`                                              | Garante isolamento no banco sem risco de ignorar RLS por conexão direta de ORM; `service_role` restrito a `external_lookup_cache`, catálogo global, `import_jobs` e exclusão de conta. |
| **D-02** | Governança do catálogo | Híbrido (`owner_id IS NULL` global + `owner_id = auth.uid()` privado)                                          | Já modelado e validado no SQL inicial; entradas manuais não poluem o catálogo global.                                                                                                  |
| **D-03** | Capas                  | Cache próprio no Storage (`covers`, WebP 256/512 px) + capa tipográfica de reserva                             | Evita hotlink quebrado, respeita fontes externas e já prepara CORS limpo para o WebGL do R1.                                                                                           |
| **D-04** | Renderização           | Server Components nas telas 2D + Server Actions validadas com Zod                                              | JS inicial enxuto (alvo <= 200 KB gzip); zero dependência de Three.js no bundle do R0.                                                                                                 |
| **D-05** | Plataforma             | Web App Mobile-First + PWA básico (`BarcodeDetector` + fallback `@zxing/browser`)                              | Atende câmera no celular e instalação sem custo de app nativo.                                                                                                                         |
| **D-06** | Hospedagem inicial     | Ambiente local (Docker/Supabase CLI) + preparação para Vercel/Cloudflare (staging/preview)                     | Sem divulgação comercial até fechamento do plano pago antes do lançamento público.                                                                                                     |
| **D-07** | Região dos dados       | `sa-east-1` (São Paulo) quando conectado ao Supabase em nuvem                                                  | Menor latência no Brasil e aderência direta à LGPD.                                                                                                                                    |
| **D-08** | Idade mínima e termos  | Aceite versionado de Termos/Privacidade + declaração de idade mínima (16 anos provisório até revisão jurídica) | Privacidade máxima por padrão (LGPD art. 14 e ECA Digital — Lei 15.211/2025).                                                                                                          |
| **D-09** | Telemetria             | Eventos internos/analytics sem cookies e sem PII (seção 17.1), desativável                                     | Mede ativação, resolução de ISBN e retenção sem rastrear títulos, notas ou dados pessoais.                                                                                             |

### 2. Arquitetura de Diretórios e Módulos Profundos (`codebase-design`)

#### 2.1 Estrutura-alvo do repositório

```text
ReadingFlow/
├─ .agents/                         # AGENTS.md e skills do Antigravity
├─ .github/workflows/               # CI (lint, typecheck, Vitest, RLS, build, Playwright, axe, Lighthouse) e backup diário
├─ GLOSSARY.md                      # Linguagem ubíqua do domínio (Obra, Edição, Exemplar, Leitura, etc.)
├─ docs/
│  ├─ produto/                      # ReadingFlow_Especificacao_v2.md (movido de .agents/)
│  ├─ adr/                          # Decisões arquiteturais numeradas (0001-...)
│  ├─ runbooks/                     # Backup/restauração, cotas de API e resposta a incidentes
│  └─ legal/                        # Rascunhos de Termos de Uso e Política de Privacidade (pt-BR)
├─ supabase/
│  ├─ config.toml                   # Configuração local Supabase CLI
│  ├─ migrations/                   # 20261107120000_schema_inicial.sql + políticas de Storage e RPCs auxiliares
│  ├─ seed.sql                      # Gêneros em pt-BR e dados sintéticos de desenvolvimento
│  └─ tests/                        # Testes SQL/pgTAP de isolamento RLS, FKs compostas e RPCs
├─ src/
│  ├─ app/                          # Next.js App Router
│  │  ├─ (marketing)/               # /, /termos, /privacidade, /ajuda
│  │  ├─ (auth)/                    # /entrar, /criar-conta, /recuperar-senha, callback OAuth
│  │  ├─ (app)/                     # Área autenticada: /painel, /estantes, /livros/[id], /adicionar,
│  │  │                             # /importar, /desejos, /leitura, /metas, /estatisticas, /configuracoes
│  │  └─ api/                       # Route handlers estritos (exportação, upload seguro de capa/avatar)
│  ├─ features/                     # Módulos profundos por domínio (R0):
│  │  ├─ auth/                      # Sessão, perfil, termos, onboarding (Módulos L, K)
│  │  ├─ catalog/                   # Obras, edições, ISBN, câmera, deduplicação (Módulo A)
│  │  ├─ shelves/                   # Estantes física/digital/áudio em lista e grade 2D (Módulo B - R0)
│  │  ├─ wishlist/                  # Desejos e compra atômica (Módulo C)
│  │  ├─ reading/                   # Estado de leitura, progresso multi-unidade e releitura (Módulo J)
│  │  ├─ goals/                     # Metas anuais/mensais, ritmo e tolerância (Módulo D - R0)
│  │  ├─ ratings/                   # Avaliação meia estrela, nota de narração e ranking geral (Módulo E - R0)
│  │  ├─ stats/                     # Totais por período/fuso e comparativo de metas (Módulo H - R0)
│  │  └─ portability/               # Importação CSV/Goodreads com rollback, exportação JSON/CSV e exclusão (K, M)
│  ├─ server/
│  │  ├─ catalog/                   # Cascata de provedores (BrasilAPI, Google Books, Open Library), cache e cotas
│  │  └─ security/                  # Rate limit, sanitização, validação de imagem, neutralização CSV, SSRF guard
│  ├─ lib/                          # supabase/ (client, server, middleware, types), env.ts, i18n/pt-BR.ts, dates.ts, isbn.ts
│  ├─ components/                   # Primitivos UI acessíveis (teclado, foco visível, ARIA, skeletons, empty states)
│  └─ styles/                       # globals.css e tokens.css da paleta "Bordô Editorial" (claro e escuro)
├─ tests/                           # Testes unitários e de integração (Vitest)
└─ e2e/                             # Fluxos críticos mobile-first + axe-core (Playwright)
```

#### 2.2 Contrato de Módulo Profundo (`src/features/<modulo>/`)

Cada módulo esconde sua complexidade interna atrás de 4 arquivos públicos enxutos:

- `rules.ts`: funções 100% puras e determinísticas (zero I/O, zero banco, fuso horário explícito como parâmetro).
- `schema.ts`: esquemas Zod compartilhados entre formulário e servidor, com mensagens externalizadas em `pt-BR`.
- `queries.ts`: leituras `server-only` usando cliente Supabase autenticado (sujeito à RLS).
- `actions.ts`: Server Actions que validam `auth.getUser()`, validam payload com `schema.ts`, aplicam `rules.ts` e persistem sem jamais confiar em `user_id` vindo do cliente.

#### 2.3 Fronteira estrita de escopo (Proteção do R0)

- **Entra no R0:** Módulos `L`, `A`, `B` (somente 2D: lista e grade), `C`, `J`, `D` (metas anuais/mensais de livros e páginas), `E` (notas de 0,5 a 5,0 + narração + ranking geral automático), `H` (estatísticas essenciais por período no fuso do perfil), `K` (onboarding 3 passos, câmera ISBN, planilha própria e CSV Goodreads com rollback), `M` (exportação JSON/CSV).
- **Fica estritamente fora do R0:** Cena 3D / Three.js (`R1`), múltiplas estantes por tipo (`R1`), sessões cronometradas (`R1`), metas em minutos/conquistas/desafios (`R1`/`R1.x`), listas temáticas manuais (`R1.x`), séries/boxes (`R1.x`), recomendações (`R1.x`), diário literário (`R1.x`), empréstimos (`R1.x`), links/imagens públicas (`R1.x`), notificações (`R2`).

### 3. Identidade Visual: Tokens "Bordô Editorial" Verificados (WCAG 2.2 AA)

Substitui integralmente a tabela provisória da seção 9.2 da especificação, com contrastes já calculados:

| Tema       | Token semântico                  | Cor (Hex)                 | Par de referência                               | Contraste    | Uso                                                    |
| ---------- | -------------------------------- | ------------------------- | ----------------------------------------------- | ------------ | ------------------------------------------------------ |
| **Claro**  | `--bg-canvas` / `--text-primary` | `#241C18` sobre `#F6F1EA` | Tinta Charuto sobre Pergaminho                  | **14,90:1**  | Fundo principal e corpo de texto                       |
| **Claro**  | `--bg-surface` / `--text-muted`  | `#5B4D44` sobre `#EDE4D8` | Tabaco Suave sobre Papel Envelhecido            | **6,44:1**   | Cartões, legendas e metadados (`7,22:1` no fundo)      |
| **Claro**  | `--text-heading`                 | `#3E1F18` sobre `#F6F1EA` | Mogno Escuro sobre Pergaminho                   | **13,22:1**  | Títulos editoriais                                     |
| **Claro**  | `--accent-primary`               | `#6E1E2A` sobre `#F6F1EA` | Couro Bordô sobre Pergaminho                    | **9,93:1**   | Ações primárias, links e foco (`8,87:1` em superfície) |
| **Claro**  | `--on-primary`                   | `#FAF6F0` sobre `#6E1E2A` | Marfim sobre Couro Bordô                        | **10,36:1**  | Texto de botões primários                              |
| **Claro**  | `--accent-wood`                  | `#7A4B2A` sobre `#F6F1EA` | Nogueira sobre Pergaminho                       | **6,52:1**   | Destaques secundários e estantes                       |
| **Claro**  | `--status-error` / `--status-ok` | `#9E2A2B` / `#235D3A`     | Carmim (`6,63:1`) / Verde Biblioteca (`6,93:1`) | **>= 6,6:1** | Erros, alertas e confirmações                          |
| **Claro**  | `--border-ui`                    | `#8C7B6E` sobre `#F6F1EA` | Borda Couro Gasto                               | **3,61:1**   | Bordas de campos e controles (meta >= 3:1)             |
| **Escuro** | `--bg-canvas` / `--text-primary` | `#F2EAE0` sobre `#181311` | Marfim Quente sobre Ébano Charuto               | **15,46:1**  | Fundo principal escuro e corpo de texto                |
| **Escuro** | `--bg-surface` / `--text-muted`  | `#BFB1A2` sobre `#231C19` | Pergaminho Cinza sobre Mogno Noite              | **8,01:1**   | Cartões e textos de apoio (`8,79:1` no fundo)          |
| **Escuro** | `--accent-primary`               | `#E07A88` sobre `#181311` | Bordô Rosé sobre Ébano                          | **6,41:1**   | Ações primárias e links (`5,84:1` em superfície)       |
| **Escuro** | `--on-primary`                   | `#181311` sobre `#E07A88` | Ébano sobre Bordô Rosé                          | **6,41:1**   | Texto sobre botão primário no tema escuro              |
| **Escuro** | `--accent-brass`                 | `#D4AF7A` sobre `#181311` | Latão Envelhecido sobre Ébano                   | **8,96:1**   | Acento editorial e marcadores                          |
| **Escuro** | `--status-error` / `--border-ui` | `#F28B82` / `#7A6A5E`     | Coral (`7,71:1`) / Borda (`3,65:1`)             | **>= 3,6:1** | Mensagens de erro e controles de formulário            |

- **Tipografia auto-hospedada (`next/font`):** `Fraunces` (ou `Source Serif 4`) para títulos editoriais + `Inter` para interface e tabelas numéricas, sem requisições em tempo de execução a terceiros.

### 4. Costuras de Teste Pré-Acordadas (`Seams` — TDD)

1. **Costura 1 — Regras Puras (`src/features/*/rules.ts` + `src/lib/isbn.ts`, Vitest, alvo >= 90%):** conversão/dígito verificador ISBN-10/13; fingerprint e duplicidade (`exact`, `probable`, `distinct`); contagem separada de obras únicas vs exemplares vs leituras vs horas; fórmulas de metas, ritmo e virada de ano no fuso do usuário (`31/12 23:30 America/Sao_Paulo`); neutralização CSV (`=`, `+`, `-`, `@`).
2. **Costura 2 — Banco e RLS (`supabase/tests/`, pgTAP/SQL):** usuário A jamais lê, insere, atualiza ou apaga registros do usuário B em nenhuma tabela; FKs compostas `(id, user_id)` impedem vínculo cruzado; `purchase_wishlist_item` é atômica; exclusão de usuário remove tudo em cascata.
3. **Costura 3 — Pipeline de Catálogo (`src/server/catalog/`, Vitest com adapters simulados):** ordem `Catálogo Interno -> Cache -> BrasilAPI (978-85/65) -> Google Books -> Open Library -> Fallback manual <= 5s`; deduplicação de chamadas simultâneas; respeito a cotas diárias.
4. **Costura 4 — Fluxos Críticos E2E e Acessibilidade (`e2e/`, Playwright mobile 360px+ + `axe-core` + `agent-browser`):** cenários 1 a 11 da seção 14.2 navegáveis por teclado e sem violações graves WCAG 2.2 AA.

### 5. Etapas Sequenciais de Criação do R0 (Backlog B01 a B26)

- **Etapa 1 — Fundação, Repositório, Documentação Viva e Design System (`B01`, `B26`)**
  - Inicializar Git, organizar `docs/produto/ReadingFlow_Especificacao_v2.md`, criar `GLOSSARY.md` (Apêndice E) e registrar `docs/adr/` iniciais (`ADR-0001` a `ADR-0013` + `D-01`..`D-09`).
  - Criar aplicação Next.js (App Router, TypeScript `strict` + `noUncheckedIndexedAccess`, Tailwind, ESLint, Prettier, Vitest, Testing Library, Playwright, `@axe-core/playwright`, Husky + `lint-staged`).
  - Configurar `src/lib/env.ts` (Zod), `.env.example`, dicionário `src/lib/i18n/pt-BR.ts`, tokens `src/styles/tokens.css` ("Bordô Editorial" claro/escuro), fontes locais e primitivos base acessíveis.
  - _Verificação:_ `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` verdes no CI (`.github/workflows/ci.yml`).

- **Etapa 2 — Banco de Dados, Storage, RLS e Camada de Segurança (`B02`, `B23`)**
  - Inicializar `supabase/config.toml`, mover `20261107120000_schema_inicial.sql` para `supabase/migrations/`, criar migração complementar para buckets e políticas do Storage (`covers` e `avatars` por `{user_id}/`), função imutável de busca sem acento, gatilho das 3 estantes iniciais (`Física`, `Digital`, `Audiobooks`) e RPC `export_my_data`.
  - Criar `supabase/seed.sql` e suíte `supabase/tests/rls_isolation.test.sql`; gerar `database.types.ts`.
  - Implementar `@supabase/ssr` (`server.ts`, `client.ts`, `middleware.ts` com `getUser()`), headers HTTP de segurança (CSP, `X-Content-Type-Options`, `Referrer-Policy`) e `src/server/security/` (rate limit, sanitização, guard contra SSRF no download de capas, neutralização CSV).
  - _Verificação:_ migrações aplicam do zero e 100% dos testes de isolamento RLS passam.

- **Etapa 3 — Núcleo de Regras de Negócio com TDD (`rules.ts` de todos os módulos do R0)**
  - Implementar no ciclo `red -> green` (Vitest): `isbn.ts`, `deduplication.ts`, `reading/rules.ts` (máquina de estados, conversões páginas/%/segundos, releituras, datas no fuso), `goals/rules.ts` (progresso, ritmo necessário, tolerância de 5%, linguagem neutra), `stats/rules.ts` e `portability/csv.ts`.
  - _Verificação:_ cobertura >= 90% nas regras puras cobrindo todos os casos obrigatórios da seção 12.2.

- **Etapa 4 — Autenticação, Perfil, Termos, Landing e Onboarding (`B03`, `B04`, `B20`)**
  - Construir `/` (Landing editorial seguindo `design-taste-frontend` + paleta Bordô Editorial), `/termos`, `/privacidade` e `/ajuda`.
  - Implementar `/entrar`, `/criar-conta` e `/recuperar-senha` (e-mail/senha e Google OAuth, verificação de e-mail, aceite versionado dos termos).
  - Implementar onboarding em 3 passos (objetivo, formatos, primeiro livro) com estados vazios orientativos e `/configuracoes` (perfil, avatar, idioma, fuso horário, moeda, tema claro/escuro/sistema, regra de releituras).
  - _Verificação:_ fluxo completo de criação de conta, aceite de termos, onboarding e persistência de preferências.

- **Etapa 5 — Catálogo, Pipeline de ISBN, Scanner por Câmera e Estantes 2D (`B06` a `B11`)**
  - Implementar `src/server/catalog/` em cascata (`Catálogo Interno -> Cache -> BrasilAPI -> Google Books -> Open Library -> Fallback manual <= 5s`), ingestão WebP 256/512 px no Storage e capa tipográfica determinística.
  - Construir `/adicionar` (busca, ISBN digitado, leitor de código de barras por câmera com fallback manual, cadastro sem ISBN com alerta de duplicidade).
  - Construir `/estantes` (abas Física, Digital e Áudio; modos Lista e Grade 2D; virtualização > 100 itens; busca tolerante a acentos/erros; ordenação e filtros) e `/livros/[id]` (obra, edições, exemplar e edição privada).
  - _Verificação:_ cenários de aceite 1, 2, 3 e 4 da seção 14.2 verdes.

- **Etapa 6 — Leitura, Desejos, Compra Atômica, Notas, Metas, Estatísticas e Painel (`B12` a `B19`, `B22`)**
  - Construir `/leitura` (estados independentes da posse, atualização em páginas/%/tempo, conclusão, abandono com motivo, releitura preservando histórico, toast com "desfazer").
  - Construir `/desejos` (prioridade, preço estimado, alerta de duplicidade, compra atômica via `purchase_wishlist_item` e arquivamento de desistência).
  - Implementar avaliações em meia estrela (0,5 a 5,0 + nota de narração) e ranking geral automático.
  - Construir `/metas`, `/estatisticas` e `/painel` (lendo agora, metas com situação neutra, próximas leituras e atividade recente).
  - _Verificação:_ cenários de aceite 5, 6 e 7 da seção 14.2 verdes.

- **Etapa 7 — Importação Idempotente, Exportação Portável e Exclusão de Conta (`B05`, `B21`)**
  - Construir `/importar` (modelo próprio e CSV Goodreads, mapeamento de colunas, pré-visualização, relatório em `import_jobs`, fila de revisão e rollback integral por lote).
  - Implementar exportação completa em JSON (backup reimportável) e CSV neutralizado, além da exclusão de conta com confirmação forte (limpeza Storage + cascata Auth/Postgres).
  - _Verificação:_ cenários de aceite 8, 9, 10 e 11 da seção 14.2 (incluindo teste de ida e volta exportar -> apagar -> reimportar).

- **Etapa 8 — Observabilidade, Backup Externo e Gate Final de Qualidade (`B24`, `B25`, `B26`)**
  - Configurar logs estruturados sem PII, contadores/alertas de cota de provedores externos, eventos sem dados pessoais (seção 17.1) e workflow agendado de backup externo criptografado (`pg_dump`) + runbook de restauração em `docs/runbooks/`.
  - Rodar auditoria final: Playwright E2E mobile/desktop, `axe-core` (zero violações graves), inspeção visual em navegador real via `agent-browser` e orçamento Lighthouse CI (LCP <= 2,5 s, INP <= 200 ms, CLS <= 0,1).

### 6. Mapa de Acionamento das Skills Instaladas (`.agents/skills/`)

- `domain-modeling`: ao criar/atualizar `GLOSSARY.md` e `docs/adr/`.
- `codebase-design`: ao definir interfaces de módulos em `src/features/*` e `src/server/*`.
- `tdd`: obrigatório na Etapa 3 e em toda regra de negócio ou correção de bug (`red -> green`).
- `design-taste-frontend`: na construção da Landing (`/`), layout editorial e componentes visuais, subordinada aos tokens **Bordô Editorial** e contraste AA deste arquivo.
- `setup-pre-commit`: na Etapa 1 para configurar Husky + `lint-staged` + typecheck + testes rápidos.
- `agent-browser`: para inspeção visual real, dogfooding de fluxos mobile/desktop e validação de estados de UI.
- `code-review`: ao final de cada etapa para revisar conformidade com este `AGENTS.md` (Standards) e com a especificação v2 (Spec).
- `diagnosing-bugs`: sempre que um teste, migração ou comportamento falhar de forma não trivial.
