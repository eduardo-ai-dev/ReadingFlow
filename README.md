# ReadingFlow

**Biblioteca pessoal digital** para livros físicos, e-books e audiobooks — individual, privada, sem rede social e com estética editorial.

Organize seu acervo em estantes 2D e 3D personalizáveis, acompanhe leituras e metas no seu fuso horário, descubra novos títulos fora da estante e mantenha portabilidade total dos seus dados.

---

## Principais Funcionalidades

- **Mesa de Leitura (`/painel`)**: visão consolidada do que está em leitura, ritmo diário/semanal, calendário de consistência, metas anuais/mensais e atividade recente.
- **Estante 3D & Estúdio de Personalização (`/estante-3d`, `/estante-3d/arrumar`)**:
  - Lombadas proporcionais ao número de páginas, agrupamento automático por gênero e Ficha Rápida lateral.
  - Presets de 1 clique, materiais de tábua, suportes, iluminação LED 3000K, objetos decorativos e modos individuais por livro (`lombada`, `capa_frente`, `inclinado`).
  - Modo Lista e Grade 2D (`/estantes`) com busca tolerante a acentos, filtros rápidos e ordenação.
- **Catalogação e Capas (`/adicionar`, `/importar`)**:
  - Busca online em cascata (BrasilAPI, Google Books, Open Library, Hardcover) com fallback editorial tipográfico.
  - Leitor de código de barras ISBN por câmera (`BarcodeDetector` + fallback `@zxing/browser`).
  - Importação CSV (modelo próprio e Goodreads) com pré-visualização e rollback por lote.
- **Leitura & Canto de Foco (`/leitura`, `/leitura/foco`)**:
  - Controle de progresso em páginas, porcentagem ou tempo (áudio), releituras com histórico preservado e avaliações em meia estrela (0,5 a 5,0).
  - Cronômetro livre / Pomodoro com persistência de sessão e **mixer de 12 sons ambiente** (chuva, lareira, biblioteca, cafeteria, ruídos branco/rosa/marrom, entre outros) com presets e timer.
- **Explorar & Sugestões de Leitura (`/explorar`, `/desejos`)**:
  - Sugestões interativas alternando entre **Lista de Desejos** (apenas títulos elegíveis ainda não lidos/em andamento) e **Novos Livros** (descoberta externa excluindo todo o acervo já catalogado).
  - Compra atômica de desejos para a estante e início direto de leitura.
- **4 Temas Curados + Acessibilidade WCAG 2.2 AA**:
  - **Caderno** (padrão claro), **Dark Academia** (escuro), **Escandinavo** (claro), **Gótico** (escuro) e modo **Automático** (segue o sistema).
  - Validação automatizada de contraste estático e **renderizado no navegador** (`npm run check:contrast` e `npm run check:contrast:rendered`).
- **Portabilidade e Privacidade (`/configuracoes`, `/api/export`)**:
  - Exportação completa em **JSON** (backup reimportável) e **CSV** com neutralização de fórmulas (`=`, `+`, `-`, `@`).

---

## Stack Técnica

- **Framework:** Next.js 16 (App Router + Turbopack + `proxy.ts`) & React 19
- **Linguagem:** TypeScript estrito (`strict` + `noUncheckedIndexedAccess`)
- **Estilização & Animações:** Tailwind CSS v4, tokens semânticos CSS (`src/styles/themes/`) e Framer Motion
- **Validação:** Zod v4
- **Testes & Qualidade:** Vitest, Testing Library, Playwright, `@axe-core/playwright`, ESLint, Prettier, Husky + `lint-staged`

---

## Como Rodar Localmente

### Pré-requisitos

- **Node.js 20+** (recomendado 22 LTS ou 24)
- **npm 10+**

### Instalação e execução

```bash
# 1. Clone o repositório
git clone https://github.com/eduardo-ai-dev/ReadingFlow.git
cd ReadingFlow

# 2. Instale as dependências
npm ci

# 3. Configure as variáveis de ambiente
cp .env.example .env.local

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

### Build de produção

```bash
npm run build
npm run start
```

---

## Variáveis de Ambiente

Consulte [`.env.example`](.env.example) para a lista completa. Principais variáveis:

| Variável                    | Escopo   | Descrição                                                                                                      |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | Público  | URL base da aplicação (ex.: `http://localhost:3000`)                                                           |
| `GOOGLE_BOOKS_API_KEY`      | Servidor | Chave opcional da Google Books API para busca de livros/capas                                                  |
| `HARDCOVER_API_TOKEN`       | Servidor | Token opcional da API Hardcover                                                                                |
| `OPEN_LIBRARY_USER_AGENT`   | Servidor | User-Agent identificado para consultas na Open Library                                                         |
| `CATALOG_LOOKUP_TIMEOUT_MS` | Servidor | Timeout das consultas externas (padrão: `4000`)                                                                |
| `RATE_LIMIT_MAX_PER_MINUTE` | Servidor | Limite de requisições por minuto por usuário (padrão: `60`)                                                    |
| `ALLOW_DEMO_SESSION`        | Servidor | Habilita explicitamente a sessão demonstrativa em produção (bloqueada por padrão quando `NODE_ENV=production`) |
| `NEXT_PUBLIC_COVER_DEBUG`   | Dev      | Quando `1` fora de produção, exibe selos técnicos de diagnóstico de capa                                       |

> **Segurança:** nunca exponha chaves privadas com prefixo `NEXT_PUBLIC_` nem comite `.env.local`.

---

## Scripts Disponíveis

```bash
npm run dev                     # Servidor de desenvolvimento
npm run build                   # Valida contraste WCAG AA + build de produção Next.js
npm run start                   # Inicia servidor de produção
npm run lint                    # ESLint em todo o projeto
npm run typecheck               # Verificação TypeScript (tsc --noEmit)
npm test                        # Suíte unitária e de componentes (Vitest)
npm run test:e2e                # Testes ponta a ponta (Playwright)
npm run check:contrast          # Validador estático WCAG AA dos 4 temas
npm run check:contrast:rendered # Validador de contraste computado real via Playwright
npm run format:check            # Verifica formatação Prettier
```

---

## Estrutura do Projeto

```text
ReadingFlow/
├─ docs/                    # Especificação de produto, ADRs e documentação legal
├─ public/                  # Ativos estáticos, capas de exemplo da landing e áudio
├─ scripts/                 # Validadores de contraste (estático e renderizado)
├─ src/
│  ├─ app/                  # App Router: (marketing), (auth), (app), api/ e global-error.tsx
│  ├─ components/           # Componentes de UI, BookCover, Book3D, ShelfView, Focus, Sugestões
│  ├─ features/             # Módulos de domínio (rules.ts, schema.ts, queries.ts, actions.ts)
│  ├─ lib/                  # Utilitários (datas/fuso, ISBN, temas, env, i18n pt-BR)
│  ├─ server/               # Provedores externos, segurança e repositório de sessão
│  ├─ styles/               # Tokens semânticos e temas curados (caderno, dark-academia, escandinavo, gotico)
│  └─ proxy.ts              # Guarda de rotas autenticadas (convenção Next.js 16)
└─ tests/                   # Testes unitários, integração e regressão (Vitest)
```

---

## Status Atual & Roadmap

- **Release R0 (concluído):** Experiência completa de biblioteca pessoal, Estante 3D + Estúdio de Personalização, Canto de Foco com mixer ambiente, Sugestões de Leitura, 4 temas validados WCAG AA e portabilidade JSON/CSV.
- **Próxima etapa (Etapa 2 — Banco de Dados):** Conectar persistência definitiva em **PostgreSQL (Supabase)** com Auth, Storage para capas/avatares e políticas **RLS** testadas (atualmente a aplicação utiliza repositório em memória isolado por sessão em `src/server/store/memory-repository.ts`, conforme ADR-0004).

---

## Licença

Projeto privado — todos os direitos reservados.
