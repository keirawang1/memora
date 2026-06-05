-- Post likes and in-app notifications

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts (post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON public.post_likes (post_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('post_like', 'post_comment', 'friend_request', 'friend_accepted')
  ),
  post_id uuid REFERENCES public.posts (post_id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.post_comments (comment_id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_post_id uuid DEFAULT NULL,
  p_comment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;
  IF p_actor_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
  VALUES (p_user_id, p_actor_id, p_type, p_post_id, p_comment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "post_likes_select_feed" ON public.post_likes;
CREATE POLICY "post_likes_select_feed" ON public.post_likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.post_id = post_likes.post_id
        AND public.can_view_user_post(p.user_id)
    )
  );

DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
CREATE POLICY "post_likes_insert_own" ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.post_id = post_likes.post_id
        AND public.can_view_user_post(p.user_id)
    )
  );

DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;
CREATE POLICY "post_likes_delete_own" ON public.post_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE post_id = NEW.post_id;
  IF v_post_owner IS NOT NULL THEN
    PERFORM public.create_notification(
      v_post_owner, NEW.user_id, 'post_comment', NEW.post_id, NEW.comment_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_comments_notify ON public.post_comments;
CREATE TRIGGER post_comments_notify
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment();

CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE post_id = NEW.post_id;
  IF v_post_owner IS NOT NULL THEN
    PERFORM public.create_notification(
      v_post_owner, NEW.user_id, 'post_like', NEW.post_id, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_likes_notify ON public.post_likes;
CREATE TRIGGER post_likes_notify
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

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

  PERFORM public.create_notification(p_target_user_id, v_caller, 'friend_request', NULL, NULL);
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
    AND NOT (v_caller = ANY(COALESCE(friends, '{}'::uuid[])));

  PERFORM public.create_notification(p_requester_id, v_caller, 'friend_accepted', NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
