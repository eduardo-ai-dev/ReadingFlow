-- Migration: Capas reais de livros (URL externa, fonte, cores de lombada, cache e bucket privado de uploads)
-- Regras: RLS existente preservada; imagens de terceiros nunca são copiadas (apenas URL);
-- uploads do usuário vão para bucket privado isolado por pasta `{auth.uid()}/...`.

-- 1. Colunas de capa e lombada em `books` (e `editions`, se presente no esquema) sem alterar políticas RLS
DO $$
BEGIN
  IF to_regclass('public.books') IS NOT NULL THEN
    ALTER TABLE public.books
      ADD COLUMN IF NOT EXISTS isbn TEXT,
      ADD COLUMN IF NOT EXISTS cover_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_source TEXT,
      ADD COLUMN IF NOT EXISTS spine_color TEXT,
      ADD COLUMN IF NOT EXISTS spine_accent TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'books_cover_source_check'
    ) THEN
      ALTER TABLE public.books
        ADD CONSTRAINT books_cover_source_check
        CHECK (cover_source IS NULL OR cover_source IN ('google', 'openlibrary', 'upload'));
    END IF;
  END IF;

  IF to_regclass('public.editions') IS NOT NULL THEN
    ALTER TABLE public.editions
      ADD COLUMN IF NOT EXISTS isbn TEXT,
      ADD COLUMN IF NOT EXISTS cover_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_source TEXT,
      ADD COLUMN IF NOT EXISTS spine_color TEXT,
      ADD COLUMN IF NOT EXISTS spine_accent TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'editions_cover_source_check'
    ) THEN
      ALTER TABLE public.editions
        ADD CONSTRAINT editions_cover_source_check
        CHECK (cover_source IS NULL OR cover_source IN ('google', 'openlibrary', 'upload'));
    END IF;
  END IF;
END
$$;

-- 2. Cache de buscas de capa no servidor (Google Books + Open Library)
CREATE TABLE IF NOT EXISTS public.cover_cache (
  cache_key TEXT PRIMARY KEY,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  degraded BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS cover_cache_expires_at_idx
  ON public.cover_cache (expires_at);

ALTER TABLE public.cover_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cover_cache'
      AND policyname = 'cover_cache_authenticated_read'
  ) THEN
    CREATE POLICY cover_cache_authenticated_read
      ON public.cover_cache
      FOR SELECT
      TO authenticated
      USING (expires_at > now());
  END IF;
END
$$;

-- 3. Bucket privado no Supabase Storage para uploads de capa do próprio usuário (restrito ao dono)
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'covers',
      'covers',
      FALSE,
      307200,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
      SET public = FALSE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'covers_owner_select'
    ) THEN
      CREATE POLICY covers_owner_select
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'covers'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'covers_owner_insert'
    ) THEN
      CREATE POLICY covers_owner_insert
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'covers'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'covers_owner_update'
    ) THEN
      CREATE POLICY covers_owner_update
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'covers'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
        WITH CHECK (
          bucket_id = 'covers'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'covers_owner_delete'
    ) THEN
      CREATE POLICY covers_owner_delete
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'covers'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
  END IF;
END
$$;
