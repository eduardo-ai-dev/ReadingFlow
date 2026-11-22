-- =============================================================================
-- ReadingFlow · Migração Canônica de Dados por Usuário (Etapa 2)
-- =============================================================================
-- Garante em todas as tabelas de dados do usuário:
-- 1. `user_id uuid not null default auth.uid()` com FK para `auth.users(id) ON DELETE CASCADE`
-- 2. RLS ligada e forçada (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`)
-- 3. Políticas com `(select auth.uid())` para initPlan único (SELECT/INSERT/UPDATE/DELETE)
-- 4. Índice em `user_id` em cada tabela do usuário
-- 5. FK composta `(book_id, user_id)` e `(shelf_id, user_id)` em `shelf_books`
--    (e `(edition_id, user_id)` / `(shelf_id, user_id)` em `library_items`)
-- 6. `user_settings` com 1 linha por usuário (`user_id uuid primary key`)
-- 7. Capa escolhida permanente: `cover_url`, `cover_source`, `cover_locked`, `cover_selected_at`
--    e bucket privado `covers` isolado por `{auth.uid()}/{book_id}/...`

-- -----------------------------------------------------------------------------
-- 1. Perfis (`profiles`) — 1 linha por usuário
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  default_currency TEXT NOT NULL DEFAULT 'BRL',
  theme TEXT NOT NULL DEFAULT 'caderno',
  density TEXT NOT NULL DEFAULT 'comfortable',
  motion TEXT NOT NULL DEFAULT 'system',
  fx TEXT NOT NULL DEFAULT 'full',
  three_d TEXT NOT NULL DEFAULT 'auto',
  goals_count_rereads BOOLEAN NOT NULL DEFAULT FALSE,
  max_simultaneous_readings INTEGER NOT NULL DEFAULT 5,
  telemetry_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_terms_version TEXT NOT NULL DEFAULT '1.0',
  accepted_terms_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_id_matches_user_id CHECK (id = user_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- -----------------------------------------------------------------------------
-- 2. Obras (`works`) e Edições/Livros (`editions`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_title TEXT,
  original_language TEXT DEFAULT 'pt-BR',
  contributors JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_published_year INTEGER,
  primary_genre TEXT,
  description TEXT,
  fingerprint TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_works_user_id ON public.works (user_id);
CREATE INDEX IF NOT EXISTS idx_works_user_created ON public.works (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL,
  isbn13 TEXT,
  isbn10 TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  publisher TEXT,
  language TEXT DEFAULT 'pt-BR',
  format TEXT NOT NULL DEFAULT 'paperback',
  pages INTEGER,
  duration_seconds INTEGER,
  cover_url TEXT,
  cover_source TEXT CHECK (
    cover_source IS NULL OR cover_source IN ('brasilapi', 'google', 'openlibrary', 'hardcover', 'apple', 'upload', 'url', 'manual')
  ),
  cover_locked BOOLEAN NOT NULL DEFAULT FALSE,
  cover_selected_at TIMESTAMPTZ,
  spine_color TEXT,
  spine_accent TEXT,
  contributors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CONSTRAINT editions_work_owner_fk
    FOREIGN KEY (work_id, user_id)
    REFERENCES public.works (id, user_id)
    ON DELETE CASCADE
);

-- Garante colunas de trava de capa caso `editions` já existisse de migração anterior
ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS cover_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_selected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_editions_user_id ON public.editions (user_id);
CREATE INDEX IF NOT EXISTS idx_editions_user_work ON public.editions (user_id, work_id);

-- -----------------------------------------------------------------------------
-- 3. Estantes (`shelves`), Vínculo Composto (`shelf_books` e `library_items`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'physical' CHECK (kind IN ('physical', 'digital', 'audio')),
  sort_mode TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shelves_user_id ON public.shelves (user_id);

CREATE TABLE IF NOT EXISTS public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  edition_id UUID NOT NULL,
  shelf_id UUID NOT NULL,
  shelf_position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'owned',
  price_paid NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  acquired_on DATE,
  store TEXT,
  condition TEXT,
  notes TEXT,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CONSTRAINT library_items_edition_owner_fk
    FOREIGN KEY (edition_id, user_id)
    REFERENCES public.editions (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT library_items_shelf_owner_fk
    FOREIGN KEY (shelf_id, user_id)
    REFERENCES public.shelves (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_items_user_id ON public.library_items (user_id);
CREATE INDEX IF NOT EXISTS idx_library_items_user_shelf_pos
  ON public.library_items (user_id, shelf_id, shelf_position);

-- Tabela canônica de alocação de livros por prateleira com FK composta `(book_id, user_id)` e `(shelf_id, user_id)`
CREATE TABLE IF NOT EXISTS public.shelf_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shelf_id UUID NOT NULL,
  book_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  display_mode TEXT NOT NULL DEFAULT 'lombada' CHECK (display_mode IN ('lombada', 'capa_frente', 'inclinado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shelf_id, book_id),
  CONSTRAINT shelf_books_book_owner_fk
    FOREIGN KEY (book_id, user_id)
    REFERENCES public.editions (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT shelf_books_shelf_owner_fk
    FOREIGN KEY (shelf_id, user_id)
    REFERENCES public.shelves (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shelf_books_user_id ON public.shelf_books (user_id);
CREATE INDEX IF NOT EXISTS idx_shelf_books_user_shelf_pos
  ON public.shelf_books (user_id, shelf_id, position);

-- -----------------------------------------------------------------------------
-- 4. Leituras (`readings`), Avaliações (`reviews`), Metas (`goals`), Desejos (`wishlist`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL,
  edition_id UUID,
  format TEXT NOT NULL DEFAULT 'paperback',
  status TEXT NOT NULL DEFAULT 'reading',
  started_on DATE,
  finished_on DATE,
  progress_unit TEXT NOT NULL DEFAULT 'pages',
  progress_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  progress_total NUMERIC(12, 2),
  counts_for_goals BOOLEAN NOT NULL DEFAULT TRUE,
  abandon_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT readings_work_owner_fk
    FOREIGN KEY (work_id, user_id)
    REFERENCES public.works (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_readings_user_id ON public.readings (user_id);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  narration_rating NUMERIC(2, 1) CHECK (narration_rating IS NULL OR (narration_rating >= 0.5 AND narration_rating <= 5.0)),
  body TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_id),
  CONSTRAINT reviews_work_owner_fk
    FOREIGN KEY (work_id, user_id)
    REFERENCES public.works (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews (user_id);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'books',
  period TEXT NOT NULL DEFAULT 'year',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  tolerance_percent INTEGER NOT NULL DEFAULT 5,
  count_rereads BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals (user_id);

CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL,
  edition_id UUID,
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  target_price NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'wanted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_work_owner_fk
    FOREIGN KEY (work_id, user_id)
    REFERENCES public.works (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist (user_id);

-- -----------------------------------------------------------------------------
-- 5. Preferências persistentes por usuário (`user_settings` — exatamente 1 linha por usuário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'caderno',
  density TEXT NOT NULL DEFAULT 'comfortable',
  motion TEXT NOT NULL DEFAULT 'system',
  fx TEXT NOT NULL DEFAULT 'full',
  shelf_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ambient_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  focus_default_mode TEXT NOT NULL DEFAULT 'free' CHECK (focus_default_mode IN ('free', 'pomodoro')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings (user_id);

-- -----------------------------------------------------------------------------
-- 6. RLS ligada + forçada e políticas uniformes `user_id = (select auth.uid())`
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  user_tables TEXT[] := ARRAY[
    'profiles',
    'works',
    'editions',
    'shelves',
    'library_items',
    'shelf_books',
    'readings',
    'reviews',
    'goals',
    'wishlist',
    'user_settings'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_owner_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (select auth.uid()));',
      t || '_owner_select',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_owner_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));',
      t || '_owner_insert',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_owner_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));',
      t || '_owner_update',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_owner_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = (select auth.uid()));',
      t || '_owner_delete',
      t
    );
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 7. Proteção de capa travada em nível de banco: jobs/backfill não sobrescrevem
--    `cover_url` quando `cover_locked = true` sem desbloqueio explícito.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_locked_edition_cover()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.cover_locked = TRUE
     AND NEW.cover_locked = TRUE
     AND NEW.cover_url IS DISTINCT FROM OLD.cover_url
     AND COALESCE(current_setting('readingflow.allow_manual_cover_override', TRUE), '') <> '1' THEN
    RAISE EXCEPTION 'Capa travada manualmente pelo usuário (cover_locked = true).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_locked_edition_cover ON public.editions;
CREATE TRIGGER trg_guard_locked_edition_cover
  BEFORE UPDATE OF cover_url ON public.editions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_locked_edition_cover();
