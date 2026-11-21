# ADR 0005: Adoção de ORM (Drizzle ORM) com Consultas Estritamente Parametrizadas e Zero Concatenação

## Status
Aceito

## Contexto
O ReadingFlow exige segurança absoluta no acesso a dados (§11 da especificação e `AGENTS.md`), proibindo estritamente a concatenação de strings para a montagem de consultas SQL (mitigando qualquer risco de SQL Injection) e estabelecendo a comunicação com o banco por meio de uma camada de ORM (Object-Relational Mapping).

Para manter a portabilidade, alta velocidade de inicialização nos testes e aderência aos padrões de código, implementou-se a camada de banco de dados com **Drizzle ORM** integrado ao driver nativo `DatabaseSync` (`node:sqlite`) do Node.js.

## Decisões

1. **Camada ORM com Drizzle ORM (`drizzle-orm`):**
   - Todos os esquemas de tabelas (`usersTable`, `worksTable`, `editionsTable`, `shelvesTable`, `libraryItemsTable`, `readingsTable`, `reviewsTable`, `goalsTable`, `wishlistTable`, `sessionsTable`) são declarados formalmente com tipos estritos em `src/server/db/schema.ts`.
   - As consultas são montadas unicamente através de métodos tipados do ORM: `db.select()`, `db.insert()`, `db.update()`, `db.delete()`, combinados com operadores estritos (`eq()`, `and()`, `asc()`, `desc()`).

2. **Zero Concatenação de Strings:**
   - Nenhuma query SQL é montada ou concatenada via interpolação de strings (`${...}`) ou operadores de adição (`+`).
   - Todos os filtros e valores são resolvidos internamente pelo Drizzle ORM através de parâmetros posicionais e passados como binds preparados (`stmt.run(...params)`, `stmt.all(...params)`, `stmt.get(...params)`).

3. **Driver Nativo e Resolução de Linhas em Matriz (`setReturnArrays`):**
   - A conexão em `src/server/db/connection.ts` utiliza `node:sqlite` (`DatabaseSync`), sem necessidade de binários C++ externos ou ferramentas de compilação nativa.
   - O proxy do Drizzle utiliza `stmt.setReturnArrays(true)` para alimentar o mapeador de colunas tipadas com máxima performance.

4. **Validação Rigorosa de Formulários e Rotas:**
   - Todas as rotas de API e Server Actions contam com esquemas de validação Zod rigorosos no servidor.
   - No frontend, os formulários contam com pré-validação antes da submissão (limites de caracteres, intervalos numéricos, tipos de formatos permitidos) e atributos nativos de acessibilidade HTML5 (`required`, `maxLength`, `min`, `max`, `aria-required`).

## Consequências
- Impossibilidade técnica de injeção de SQL por concatenação.
- Tipagem fim-a-fim entre os modelos de banco de dados e o domínio TypeScript.
- Compatibilidade direta com migrações futuras para PostgreSQL/Supabase preservando o mesmo contrato ORM.

