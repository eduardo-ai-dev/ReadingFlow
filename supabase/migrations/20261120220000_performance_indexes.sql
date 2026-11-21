-- Migration: Índices compostos de desempenho para listagens por usuário, status e ordenação recente
-- Seguro e idempotente: verifica existência das tabelas antes de criar índices.

DO $$
BEGIN
  IF to_regclass('public.library_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS library_items_user_status_idx
      ON public.library_items (user_id, status);
    CREATE INDEX IF NOT EXISTS library_items_user_created_at_idx
      ON public.library_items (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS library_items_user_shelf_pos_idx
      ON public.library_items (user_id, shelf_id, shelf_position);
  END IF;

  IF to_regclass('public.readings') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS readings_user_status_idx
      ON public.readings (user_id, status);
    CREATE INDEX IF NOT EXISTS readings_user_updated_at_idx
      ON public.readings (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS readings_user_work_updated_idx
      ON public.readings (user_id, work_id, updated_at DESC);
  END IF;

  IF to_regclass('public.wishlist') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS wishlist_user_status_created_idx
      ON public.wishlist (user_id, status, created_at DESC);
  END IF;

  IF to_regclass('public.wishlist_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS wishlist_items_user_status_created_idx
      ON public.wishlist_items (user_id, status, created_at DESC);
  END IF;

  IF to_regclass('public.goals') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS goals_user_created_at_idx
      ON public.goals (user_id, created_at DESC);
  END IF;

  IF to_regclass('public.reading_goals') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS reading_goals_user_created_at_idx
      ON public.reading_goals (user_id, created_at DESC);
  END IF;

  IF to_regclass('public.reviews') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS reviews_user_updated_at_idx
      ON public.reviews (user_id, updated_at DESC);
  END IF;

  IF to_regclass('public.editions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS editions_work_id_idx
      ON public.editions (work_id);
  END IF;
END
$$;
