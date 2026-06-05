-- Bio (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;

-- Library sort preferences
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS board_sort_mode text NOT NULL DEFAULT 'alphabetical',
  ADD COLUMN IF NOT EXISTS board_custom_order uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_sort_mode text NOT NULL DEFAULT 'alphabetical';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_board_sort_mode_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_board_sort_mode_check
  CHECK (board_sort_mode IN ('alphabetical', 'last_edited', 'custom'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_media_sort_mode_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_media_sort_mode_check
  CHECK (media_sort_mode IN ('alphabetical', 'last_edited', 'custom'));

-- Last-edited timestamps
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.boards
SET updated_at = COALESCE(created_at::timestamptz, now())
WHERE updated_at IS NULL;

UPDATE public.media
SET updated_at = COALESCE(created_at::timestamptz, now())
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boards_touch_updated_at ON public.boards;
CREATE TRIGGER boards_touch_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS media_touch_updated_at ON public.media;
CREATE TRIGGER media_touch_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
