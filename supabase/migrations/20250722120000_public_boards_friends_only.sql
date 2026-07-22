-- Friends-only visibility for public boards (off by default)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_boards_friends_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_view_public_board(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.users owner
      WHERE owner.user_id = p_owner_id
        AND (
          COALESCE(owner.public_boards_friends_only, false) = false
          OR (SELECT auth.uid()) = ANY (COALESCE(owner.friends, '{}'::uuid[]))
        )
    );
$$;

DROP POLICY IF EXISTS "boards_select_own_or_public" ON public.boards;
CREATE POLICY "boards_select_own_or_public" ON public.boards
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (
      is_public = true
      AND public.can_view_public_board(user_id)
    )
  );

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
        AND public.can_view_public_board(b.user_id)
    )
  );
