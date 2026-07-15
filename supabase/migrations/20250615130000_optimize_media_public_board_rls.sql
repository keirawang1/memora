-- media_select_on_public_board scanned every public board's media[] per row (slow/timeouts).
-- Use media.board_ids + board PK lookup instead.
DROP POLICY IF EXISTS "media_select_on_public_board" ON public.media;

CREATE POLICY "media_select_on_public_board" ON public.media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.is_public = true
        AND b.user_id = media.user_id
        AND b.board_id = ANY (COALESCE(media.board_ids, '{}'::uuid[]))
    )
  );
