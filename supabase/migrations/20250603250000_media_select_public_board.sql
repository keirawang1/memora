-- Allow authenticated users to read media listed on another user's public board
CREATE POLICY "media_select_on_public_board" ON public.media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.is_public = true
        AND b.user_id = media.user_id
        AND media.media_id = ANY (COALESCE(b.media, '{}'::uuid[]))
    )
  );
