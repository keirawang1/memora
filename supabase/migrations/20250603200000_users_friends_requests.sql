-- Friend graph stored on public.users: friends (accepted), requests (incoming sender ids)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS friends uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requests uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.send_friend_request(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_caller = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot add yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = v_caller AND p_target_user_id = ANY(COALESCE(friends, '{}'::uuid[]))
  ) THEN
    RAISE EXCEPTION 'Already friends';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = p_target_user_id AND v_caller = ANY(COALESCE(requests, '{}'::uuid[]))
  ) THEN
    RAISE EXCEPTION 'Request already pending';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = v_caller AND p_target_user_id = ANY(COALESCE(requests, '{}'::uuid[]))
  ) THEN
    RAISE EXCEPTION 'They already sent you a request';
  END IF;

  UPDATE public.users
  SET requests = array_append(COALESCE(requests, '{}'::uuid[]), v_caller)
  WHERE user_id = p_target_user_id
    AND NOT (v_caller = ANY(COALESCE(requests, '{}'::uuid[])));
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = v_caller AND p_requester_id = ANY(COALESCE(requests, '{}'::uuid[]))
  ) THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  UPDATE public.users
  SET
    requests = array_remove(COALESCE(requests, '{}'::uuid[]), p_requester_id),
    friends = (
      SELECT array_agg(DISTINCT x)
      FROM unnest(array_append(COALESCE(friends, '{}'::uuid[]), p_requester_id)) AS x
    )
  WHERE user_id = v_caller;

  UPDATE public.users
  SET friends = (
    SELECT array_agg(DISTINCT x)
    FROM unnest(array_append(COALESCE(friends, '{}'::uuid[]), v_caller)) AS x
  )
  WHERE user_id = p_requester_id
    AND NOT (v_caller = ANY (COALESCE(friends, '{}'::uuid[])));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
  SET requests = array_remove(COALESCE(requests, '{}'::uuid[]), p_requester_id)
  WHERE user_id = v_caller;
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_friend_request(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_friend_request(uuid) TO authenticated;
