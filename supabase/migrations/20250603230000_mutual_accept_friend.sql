-- Accept must add each user to the other's friends array (mutual friendship)
CREATE OR REPLACE FUNCTION public.append_friend_id(target_friends uuid[], friend_id uuid)
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT u ORDER BY u)
      FROM unnest(COALESCE(target_friends, '{}'::uuid[]) || ARRAY[friend_id]) AS u
    ),
    ARRAY[friend_id]::uuid[]
  );
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_accepter_friends uuid[];
  v_requester_friends uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT friends
  INTO v_accepter_friends
  FROM public.users
  WHERE user_id = v_caller
    AND p_requester_id = ANY (COALESCE(requests, '{}'::uuid[]))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  SELECT friends
  INTO v_requester_friends
  FROM public.users
  WHERE user_id = p_requester_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requester not found';
  END IF;

  UPDATE public.users
  SET
    requests = array_remove(COALESCE(requests, '{}'::uuid[]), p_requester_id),
    friends = public.append_friend_id(v_accepter_friends, p_requester_id)
  WHERE user_id = v_caller;

  UPDATE public.users
  SET friends = public.append_friend_id(v_requester_friends, v_caller)
  WHERE user_id = p_requester_id;
END;
$$;
