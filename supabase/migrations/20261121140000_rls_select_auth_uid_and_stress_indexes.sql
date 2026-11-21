-- =============================================================================
-- Migração: Otimização de políticas RLS com (select auth.uid()) e índices de carga (2.000+ livros)
-- =============================================================================
-- 1. Substitui chamadas por linha a auth.uid() em storage.objects por (select auth.uid())
--    para permitir initPlan único no planejador do PostgreSQL.
-- 2. Adiciona índices compostos cobrindo colunas das políticas RLS e filtros de
--    Painel, Estantes, Busca e Métricas para acervos de 1.000 a 2.000+ livros.

drop policy if exists "covers_owner_select" on storage.objects;
create policy "covers_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

drop policy if exists "covers_owner_insert" on storage.objects;
create policy "covers_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

drop policy if exists "covers_owner_update" on storage.objects;
create policy "covers_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  )
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

drop policy if exists "covers_owner_delete" on storage.objects;
create policy "covers_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

-- Índices compostos para RLS + filtros e ordenação em acervos grandes
create index if not exists idx_works_owner_created_desc
  on public.works (owner_id, created_at desc);

create index if not exists idx_works_owner_genre
  on public.works (owner_id, primary_genre);

create index if not exists idx_editions_owner_format
  on public.editions (owner_id, format);

create index if not exists idx_editions_work_id
  on public.editions (work_id);

create index if not exists idx_shelves_user_position
  on public.shelves (user_id, position asc);

create index if not exists idx_library_items_user_status
  on public.library_items (user_id, status);

create index if not exists idx_readings_user_status_updated
  on public.readings (user_id, status, updated_at desc);

create index if not exists idx_readings_user_work
  on public.readings (user_id, work_id);

create index if not exists idx_reviews_user_work
  on public.reviews (user_id, work_id);
