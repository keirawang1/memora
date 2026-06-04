-- Allow either party to remove the other from their friends array
DROP POLICY IF EXISTS "users_remove_self_from_friends" ON public.users;
CREATE POLICY "users_remove_self_from_friends" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = ANY (COALESCE(friends, '{}'::uuid[])))
  WITH CHECK (
    NOT ((select auth.uid()) = ANY (COALESCE(friends, '{}'::uuid[])))
  );
