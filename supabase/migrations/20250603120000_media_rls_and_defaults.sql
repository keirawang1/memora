-- Media: RLS was enabled with no policies (blocked all access)
CREATE POLICY "media_select_own" ON public.media
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "media_insert_own" ON public.media
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "media_update_own" ON public.media
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "media_delete_own" ON public.media
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

ALTER TABLE public.media
  ALTER COLUMN media_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN board_ids SET DEFAULT '{}'::uuid[];

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS media_user_id_idx ON public.media (user_id);
