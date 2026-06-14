ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS background_color text;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_theme_mode_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_theme_mode_check
  CHECK (theme_mode IN ('light', 'dark', 'custom'));
