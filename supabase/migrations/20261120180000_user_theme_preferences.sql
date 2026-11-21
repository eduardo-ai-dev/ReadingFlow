-- ============================================================================
-- ReadingFlow · Migração: Preferências de Tema, Densidade e Movimento no Perfil
-- Permite sincronização entre dispositivos via perfil do usuário (Supabase)
-- mantendo retrocompatibilidade com valores legados ('light', 'dark', 'system').
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'editorial-light',
      ADD COLUMN IF NOT EXISTS density text NOT NULL DEFAULT 'comfortable',
      ADD COLUMN IF NOT EXISTS motion text NOT NULL DEFAULT 'system';

    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_theme_check;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_check
      CHECK (theme IN ('system', 'light', 'dark', 'editorial-light', 'editorial-dark'));

    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_density_check;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_density_check
      CHECK (density IN ('compact', 'comfortable', 'spacious'));

    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_motion_check;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_motion_check
      CHECK (motion IN ('system', 'reduced', 'full'));
  END IF;
END $$;
