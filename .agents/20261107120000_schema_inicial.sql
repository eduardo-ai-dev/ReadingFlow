-- =====================================================================
-- ReadingFlow · esquema inicial (rascunho v2) · PostgreSQL / Supabase
-- Regras: PK uuid · timestamptz · RLS em todas as tabelas · segredos fora do banco
-- owner_id NULL = catálogo global (só o servidor escreve) · preenchido = privado
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------- Tipos ----------
create type book_format as enum
  ('hardcover','paperback','pocket','ebook','audiobook','box','other');
create type shelf_kind       as enum ('physical','digital','audio');
create type ownership_status as enum ('owned','borrowed','lent','sold','donated','lost');
create type reading_status   as enum ('reading','paused','finished','abandoned');
create type progress_unit    as enum ('pages','percent','seconds');
create type contributor_role as enum
  ('author','translator','illustrator','narrator','editor','organizer');
create type goal_kind        as enum ('books','pages','minutes');
create type goal_period      as enum ('year','month','custom');
create type list_kind        as enum ('ranking','thematic','challenge','queue');
create type wish_status      as enum ('wanted','purchased','dropped');
create type loan_direction   as enum ('lent','borrowed');

-- ---------- Funções utilitárias ----------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ISBN-13: 12 dígitos ponderados 1,3,1,3... + dígito verificador
create function public.is_valid_isbn13(code text) returns boolean
language sql immutable parallel safe as $$
  select case when code ~ '^[0-9]{13}$' then
    (10 - (select sum(substr(code, i, 1)::int * (case when i % 2 = 1 then 1 else 3 end))
             from generate_series(1, 12) as i) % 10) % 10 = substr(code, 13, 1)::int
  else false end
$$;

-- ---------- Catálogo (global + privado) ----------
create table public.genres (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name_pt   text not null,
  parent_id uuid references public.genres (id)
);

create table public.publishers (
  id       uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name     text not null
);
create unique index publishers_global_name_uq
  on public.publishers (lower(name)) where owner_id is null;

create table public.people (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users (id) on delete cascade,
  name       text not null,
  sort_name  text,
  created_at timestamptz not null default now()
);
create index people_name_trgm on public.people using gin (name extensions.gin_trgm_ops);

create table public.works (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid references auth.users (id) on delete cascade,
  title                text not null,
  original_title       text,
  original_language    text,
  first_published_year smallint check (first_published_year between 0 and 2100),
  description          text,
  primary_genre_id     uuid references public.genres (id),
  fingerprint          text,  -- título + 1º autor normalizados (calculado no app)
  source               text not null default 'manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index works_fingerprint_idx on public.works (fingerprint);
create index works_title_trgm on public.works using gin (title extensions.gin_trgm_ops);

create table public.work_contributors (
  work_id   uuid not null references public.works (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role      contributor_role not null default 'author',
  position  smallint not null default 0,
  primary key (work_id, person_id, role)
);

create table public.work_genres (
  work_id    uuid not null references public.works (id) on delete cascade,
  genre_id   uuid not null references public.genres (id),
  is_primary boolean not null default false,
  primary key (work_id, genre_id)
);

create table public.editions (
  id               uuid primary key default gen_random_uuid(),
  work_id          uuid not null references public.works (id) on delete cascade,
  owner_id         uuid references auth.users (id) on delete cascade,
  isbn13           text check (isbn13 is null or public.is_valid_isbn13(isbn13)),
  isbn10           text check (isbn10 is null or isbn10 ~ '^[0-9]{9}[0-9X]$'),
  title            text,
  subtitle         text,
  publisher_id     uuid references public.publishers (id),
  language         text not null default 'pt-BR',
  format           book_format not null,
  pages            integer check (pages > 0),
  duration_seconds integer check (duration_seconds > 0),
  published_on     date,
  edition_label    text,                    -- ex.: "2ª edição", "edição de colecionador"
  height_mm        smallint check (height_mm > 0),
  width_mm         smallint check (width_mm > 0),
  thickness_mm     smallint check (thickness_mm > 0),
  cover_path       text,                    -- Supabase Storage (miniaturas 256/512 px)
  cover_color      text check (cover_color is null or cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  external_ids     jsonb not null default '{}'::jsonb,
  source           text not null default 'manual',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index editions_isbn13_global_uq
  on public.editions (isbn13) where owner_id is null and isbn13 is not null;
create unique index editions_isbn13_owner_uq
  on public.editions (owner_id, isbn13) where owner_id is not null and isbn13 is not null;
create index editions_work_idx on public.editions (work_id);

create table public.edition_contributors (
  edition_id uuid not null references public.editions (id) on delete cascade,
  person_id  uuid not null references public.people (id) on delete cascade,
  role       contributor_role not null,
  position   smallint not null default 0,
  primary key (edition_id, person_id, role)
);

create table public.series (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users (id) on delete cascade,
  name           text not null,
  declared_total numeric(5,1) check (declared_total > 0),
  is_complete    boolean,
  source         text not null default 'manual',
  created_at     timestamptz not null default now()
);

create table public.series_works (
  series_id           uuid not null references public.series (id) on delete cascade,
  work_id             uuid not null references public.works (id) on delete cascade,
  volume              numeric(5,1),         -- aceita 1.5 (novelas)
  relation            text not null default 'main'
    check (relation in ('main','prequel','spinoff','novella','anthology')),
  publication_order   smallint,
  chronological_order smallint,
  primary key (series_id, work_id)
);

-- ---------- Perfil e preferências ----------
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text not null check (char_length(display_name) between 1 and 60),
  avatar_path            text,
  locale                 text not null default 'pt-BR',
  timezone               text not null default 'America/Sao_Paulo',
  default_currency       char(3) not null default 'BRL',
  theme                  text not null default 'system'
    check (theme in ('system','light','dark')),
  three_d                text not null default 'auto'
    check (three_d in ('auto','on','off')),
  goals_count_rereads    boolean not null default false,
  accepted_terms_version text,
  accepted_terms_at      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------- Acervo do usuário ----------
-- Padrão: user_id em toda tabela do usuário + FK composta (id, user_id) nas relações,
-- para que ninguém consiga ligar o próprio registro a uma estante/lista de outra pessoa.
create table public.shelves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  kind       shelf_kind not null,
  sort_mode  text not null default 'manual'
    check (sort_mode in ('manual','title','author','acquired','finished','color','series')),
  appearance jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.library_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  edition_id        uuid not null references public.editions (id),
  shelf_id          uuid,
  shelf_position    integer,
  status            ownership_status not null default 'owned',
  acquired_on       date,
  price_paid        numeric(10,2) check (price_paid >= 0),
  currency          char(3) not null default 'BRL',
  store             text,
  condition         text check (condition in ('new','good','worn','damaged')),
  is_signed         boolean not null default false,
  special_note      text,
  physical_location text,                   -- "Sala > Estante 2 > Prateleira 3"
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (shelf_id, user_id) references public.shelves (id, user_id)
    on delete set null (shelf_id)
);

create table public.wishlist_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id         uuid not null references public.works (id),
  edition_id      uuid references public.editions (id),
  priority        smallint not null default 3 check (priority between 1 and 5),
  target_price    numeric(10,2) check (target_price >= 0),
  currency        char(3) not null default 'BRL',
  where_to_buy    text,
  notes           text,
  status          wish_status not null default 'wanted',
  resolved_at     timestamptz,
  library_item_id uuid,
  created_at      timestamptz not null default now(),
  foreign key (library_item_id, user_id) references public.library_items (id, user_id)
    on delete set null (library_item_id)
);
create unique index wishlist_one_active_per_work
  on public.wishlist_items (user_id, work_id) where status = 'wanted';

create table public.loans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  library_item_id uuid not null,
  direction       loan_direction not null,
  counterpart     text not null,            -- nome livre; a pessoa não usa a plataforma
  lent_on         date not null default current_date,
  due_on          date,
  returned_on     date,
  notes           text,
  foreign key (library_item_id, user_id) references public.library_items (id, user_id)
    on delete cascade,
  check (returned_on is null or returned_on >= lent_on)
);
create index loans_open_idx on public.loans (user_id, due_on) where returned_on is null;

-- ---------- Leitura, avaliações e notas ----------
create table public.readings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id          uuid not null references public.works (id),
  edition_id       uuid references public.editions (id),
  library_item_id  uuid,
  status           reading_status not null default 'reading',
  started_on       date,
  finished_on      date,
  progress_unit    progress_unit not null default 'pages',
  progress_value   numeric(10,2) not null default 0 check (progress_value >= 0),
  progress_total   numeric(10,2) check (progress_total > 0),
  counts_for_goals boolean not null default true,
  abandon_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  foreign key (library_item_id, user_id) references public.library_items (id, user_id)
    on delete set null (library_item_id),
  check (finished_on is null or started_on is null or finished_on >= started_on),
  check (status <> 'finished' or finished_on is not null)
);
create index readings_user_status_idx   on public.readings (user_id, status);
create index readings_user_finished_idx on public.readings (user_id, finished_on desc);

create table public.reading_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reading_id     uuid not null,
  session_date   date not null,
  pages_read     integer check (pages_read >= 0),
  seconds_spent  integer check (seconds_spent >= 0),
  progress_after numeric(10,2),
  note           text,
  created_at     timestamptz not null default now(),
  foreign key (reading_id, user_id) references public.readings (id, user_id)
    on delete cascade
);
create index reading_sessions_user_date_idx on public.reading_sessions (user_id, session_date);

create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id          uuid not null references public.works (id),
  rating           numeric(2,1)
    check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  narration_rating numeric(2,1)
    check (narration_rating between 0.5 and 5
           and narration_rating * 2 = trunc(narration_rating * 2)),
  body             text,
  has_spoilers     boolean not null default false,
  is_private       boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, work_id)
);

create table public.reading_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id     uuid not null references public.works (id),
  reading_id  uuid,
  kind        text not null default 'note' check (kind in ('note','quote','impression')),
  body        text not null,
  page_start  integer,
  page_end    integer,
  chapter     text,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (reading_id, user_id) references public.readings (id, user_id)
    on delete set null (reading_id)
);

-- ---------- Metas, listas e conquistas ----------
create table public.reading_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text,
  kind          goal_kind not null,
  period        goal_period not null,
  starts_on     date not null,
  ends_on       date not null,
  target_value  integer not null check (target_value > 0),
  count_rereads boolean not null default false,
  formats       book_format[],              -- NULL = todos os formatos
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  check (ends_on >= starts_on)
);

create table public.goal_adjustments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  old_target integer not null,
  new_target integer not null check (new_target > 0),
  changed_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.reading_goals (id, user_id)
    on delete cascade
);

create table public.custom_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  kind        list_kind not null default 'thematic',
  deadline_on date,
  is_private  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create table public.custom_list_items (
  list_id  uuid not null,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id  uuid not null references public.works (id),
  position text not null collate "C",       -- chave fracionária: reordenar sem reescrever tudo
  note     text,
  added_at timestamptz not null default now(),
  primary key (list_id, work_id),
  foreign key (list_id, user_id) references public.custom_lists (id, user_id)
    on delete cascade
);
create index custom_list_items_order_idx on public.custom_list_items (list_id, position);

create table public.achievement_definitions (
  code        text primary key,
  title       text not null,
  description text,
  criteria    jsonb not null default '{}'::jsonb
);

create table public.user_achievements (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code        text not null references public.achievement_definitions (code),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- ---------- Importação, compartilhamento e cache externo ----------
create table public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source        text not null check (source in ('template','goodreads','storygraph','isbn_list')),
  status        text not null default 'pending'
    check (status in ('pending','running','done','failed','rolled_back')),
  total_rows    integer,
  imported_rows integer,
  failed_rows   integer,
  report        jsonb,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('shelf','list','recap')),
  resource_id uuid,
  token       text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table public.external_lookup_cache (
  provider   text not null,
  lookup_key text not null,
  found      boolean not null,
  payload    jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (provider, lookup_key)
);

-- ---------- Gatilhos ----------
do $$
declare t text;
begin
  foreach t in array array['works','editions','profiles','library_items','readings',
                           'reviews','reading_notes','reading_goals','custom_lists'] loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;
end $$;

-- Cria o perfil automaticamente quando a conta é criada (padrão Supabase)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
                                nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                                'Leitor'), 60));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS: negar por padrão, liberar por política ----------
-- 1) Tabelas do usuário: ele lê e escreve só o que é dele.
do $$
declare t text;
begin
  foreach t in array array['shelves','library_items','wishlist_items','loans','readings',
      'reading_sessions','reviews','reading_notes','reading_goals','goal_adjustments',
      'custom_lists','custom_list_items','share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index %I on public.%I (user_id)', t || '_user_id_idx', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated
                    using ((select auth.uid()) = user_id)
                    with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated
                    using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- 2) Somente leitura para o usuário (quem escreve é o servidor com service_role).
do $$
declare t text;
begin
  foreach t in array array['user_achievements','import_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using ((select auth.uid()) = user_id)', t || '_select_own', t);
  end loop;
end $$;

-- 3) Catálogo: lê o global (owner_id nulo) + o que é seu; escreve só o que é seu.
do $$
declare t text;
begin
  foreach t in array array['works','editions','people','publishers','series'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (owner_id is null or owner_id = (select auth.uid()))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated
                    with check (owner_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated
                    using (owner_id = (select auth.uid()))
                    with check (owner_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated
                    using (owner_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

-- 4) Tabelas de ligação do catálogo herdam a regra da tabela-pai.
do $$
declare spec text; t text; parent text; fk text;
begin
  foreach spec in array array['work_contributors:works:work_id', 'work_genres:works:work_id',
      'edition_contributors:editions:edition_id', 'series_works:series:series_id'] loop
    t := split_part(spec, ':', 1);
    parent := split_part(spec, ':', 2);
    fk := split_part(spec, ':', 3);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (exists (select 1 from public.%I p where p.id = %I.%I))',
                   t || '_select', t, parent, t, fk);
    execute format('create policy %I on public.%I for all to authenticated
                    using (exists (select 1 from public.%I p
                                   where p.id = %I.%I and p.owner_id = (select auth.uid())))
                    with check (exists (select 1 from public.%I p
                                   where p.id = %I.%I and p.owner_id = (select auth.uid())))',
                   t || '_write_own', t, parent, t, fk, parent, t, fk);
  end loop;
end $$;

-- 5) Perfil, tabelas de referência e cache.
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.genres enable row level security;
create policy genres_select on public.genres for select to authenticated using (true);
alter table public.achievement_definitions enable row level security;
create policy achievement_definitions_select on public.achievement_definitions
  for select to authenticated using (true);

alter table public.external_lookup_cache enable row level security;  -- sem políticas
revoke all on public.external_lookup_cache from anon, authenticated;  -- só service_role

-- ---------- RPC transacional: comprar um item da lista de desejos ----------
-- security invoker: continua sujeita à RLS do usuário que chamou.
create function public.purchase_wishlist_item(
  p_wishlist_id uuid, p_edition_id uuid, p_shelf_id uuid,
  p_price numeric default null, p_acquired_on date default current_date,
  p_store text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_item uuid;
begin
  insert into public.library_items (user_id, edition_id, shelf_id, price_paid, acquired_on, store)
  values ((select auth.uid()), p_edition_id, p_shelf_id, p_price, p_acquired_on, p_store)
  returning id into v_item;

  update public.wishlist_items
     set status = 'purchased', resolved_at = now(),
         library_item_id = v_item, edition_id = p_edition_id
   where id = p_wishlist_id and user_id = (select auth.uid()) and status = 'wanted';
  if not found then
    raise exception 'item da lista de desejos inexistente ou já resolvido';
  end if;
  return v_item;
end $$;
revoke all on function public.purchase_wishlist_item(uuid, uuid, uuid, numeric, date, text)
  from public, anon;
grant execute on function public.purchase_wishlist_item(uuid, uuid, uuid, numeric, date, text)
  to authenticated;
