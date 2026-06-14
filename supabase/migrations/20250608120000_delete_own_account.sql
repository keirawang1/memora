-- Allow authenticated users to delete their own account and related data
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
  SET
    friends = array_remove(COALESCE(friends, '{}'::uuid[]), v_uid),
    requests = array_remove(COALESCE(requests, '{}'::uuid[]), v_uid)
  WHERE v_uid = ANY (COALESCE(friends, '{}'::uuid[]))
     OR v_uid = ANY (COALESCE(requests, '{}'::uuid[]));

  DELETE FROM public.media WHERE user_id = v_uid;
  DELETE FROM public.boards WHERE user_id = v_uid;
  DELETE FROM public.users WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
