-- Speed up board list / public board filters and array membership lookups.
CREATE INDEX IF NOT EXISTS boards_user_id_created_at_idx
  ON public.boards (user_id, created_at);

CREATE INDEX IF NOT EXISTS boards_user_id_is_public_idx
  ON public.boards (user_id, is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS boards_media_gin_idx
  ON public.boards USING GIN (media);

CREATE INDEX IF NOT EXISTS media_board_ids_gin_idx
  ON public.media USING GIN (board_ids);
