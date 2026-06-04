-- Required for sign-in: authenticated users must be able to read their own row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_select_discovery" ON public.users;
CREATE POLICY "users_select_discovery" ON public.users
  FOR SELECT TO authenticated
  USING ((select auth.uid()) <> user_id);
