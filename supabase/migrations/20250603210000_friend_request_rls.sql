-- One-time: drop legacy typo column `requsts` (data merged into `requests` when both exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'requsts'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'requests'
  ) THEN
    UPDATE public.users
    SET requests = (
      SELECT array_agg(DISTINCT x)
      FROM unnest(
        COALESCE(requests, '{}'::uuid[]) || COALESCE(requsts, '{}'::uuid[])
      ) AS x
    );
    ALTER TABLE public.users DROP COLUMN requsts;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'requsts'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN requsts TO requests;
  END IF;
END $$;

ALTER TABLE public.users DROP COLUMN IF EXISTS requsts;

-- Friend requests: sender appends self to receiver's requests array
DROP POLICY IF EXISTS "users_receive_friend_request" ON public.users;
CREATE POLICY "users_receive_friend_request" ON public.users
  FOR UPDATE TO authenticated
  USING (user_id <> (select auth.uid()))
  WITH CHECK (
    user_id <> (select auth.uid())
    AND (select auth.uid()) = ANY (COALESCE(requests, '{}'::uuid[]))
  );

-- Accept: accepter adds self to requester's friends
DROP POLICY IF EXISTS "users_add_self_to_requester_friends" ON public.users;
CREATE POLICY "users_add_self_to_requester_friends" ON public.users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users me
      WHERE me.user_id = (select auth.uid())
        AND public.users.user_id = ANY (COALESCE(me.requests, '{}'::uuid[]))
        AND public.users.user_id <> me.user_id
    )
  )
  WITH CHECK (
    (select auth.uid()) = ANY (COALESCE(friends, '{}'::uuid[]))
  );
