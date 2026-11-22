# ADR-0006 — Decisões de Produto e Infraestrutura (Estante 3D, Capas, Provedores e Deploy)

- **Status:** Aceito
- **Data:** 2026-11-22
- **Contexto:** Fechamento das Etapas 1–6 (R0 + Estante 3D) e preparação para a Etapa 7 (migração para Supabase em staging).

## Decisões

### 1. Estante 3D — Segunda fileira ao fundo

- **Decisão:** Não adicionar agora; manter o fundo limpo dos compartimentos.
- **Critério de reavaliação:** Somente no futuro como opção decorativa desligável, e apenas se o desempenho medido com 500 livros não sofrer regressão.

### 2. Capas no seed de desenvolvimento e em demonstrações públicas

- **Seed de desenvolvimento (`dev`):** pré-popular com capas estáticas locais para validação visual, mantendo **3 a 4 livros sem capa** como fixtures permanentes dos testes de fallback editorial.
- **Demonstração pública:** usar exclusivamente títulos e capas de domínio público ou ilustradas; a sessão de demonstração deve ser **somente leitura**, isolada, claramente rotulada e **nunca escrever na conta real**.

### 3. Provedores externos de capa

- **Decisão:** Configurar `GOOGLE_BOOKS_API_KEY` e `HARDCOVER_API_TOKEN` estritamente no servidor (variáveis de ambiente sem prefixo `NEXT_PUBLIC_`, nunca em commit), com chaves separadas por ambiente (`dev`, `staging`, `prod`).
- **Hardening operacional:** restringir a chave do Google à Books API e configurar alertas de cota; manter o cache, backoff de `429`/`403`/timeout e imutabilidade de `cover_locked = true`.

### 4. Hospedagem e deploy

- **Decisão:** **Vercel (região `gru1`, São Paulo)** + **Supabase (`sa-east-1`, São Paulo)**.
- **Experimento Cloudflare descartado da `main`:** `@opennextjs/cloudflare` e `wrangler` foram isolados na branch `exp/cloudflare` e removidos do `package.json` principal.
- **Motivo:** o projeto utiliza módulos nativos (`sharp`, `argon2`/Node crypto) incompatíveis com Workers e depende do suporte integral do Next.js 16 na Vercel.

## Consequências

- `vercel.json` fixa a execução das funções na região `gru1`, alinhada à região `sa-east-1` do Supabase para menor latência no Brasil e conformidade com a LGPD.
- A sequência operacional seguinte passa a ser:
  1. Limpeza do working tree, padronização LF e bloqueio de `middleware.ts` legado no lint/CI.
  2. Etapa 7: migração da camada de dados para Supabase em staging, rodando a suíte nos dois adaptadores.
  3. Teste de estresse em staging com mocks das APIs de capa.
  4. Smoke test em iPhone físico apontando para o staging.
  5. Só então iniciar R1 e publicação.
