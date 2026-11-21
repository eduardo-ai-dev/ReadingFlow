# Adaptador de repositório em memória antes da ativação do banco de dados

Por decisão de iniciar a construção sem a camada de banco de dados (adiando a Etapa 2 de migrações Supabase/PostgreSQL), toda leitura e mutação dos módulos de domínio atravessa uma costura explícita (`LibraryRepository`). Na fase atual sem banco, um adaptador determinístico no servidor mantém o estado por sessão com dados iniciais realistas, permitindo validar 100% das regras de negócio, validações Zod, Server Actions e fluxos E2E antes de conectar o `@supabase/ssr` com RLS.
