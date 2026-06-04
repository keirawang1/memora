-- Social feed: posts, comments, and post image storage

CREATE TABLE IF NOT EXISTS public.posts (
  post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  text text NOT NULL,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_text_not_empty CHECK (char_length(trim(text)) > 0)
);

-- Legacy migration used body/image_url; align if an older partial schema exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'text'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN body TO text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'image_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'image'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN image_url TO image;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.post_comments (
  comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts (post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments (post_id, created_at);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;

-- Visible if author is self or an accepted friend
CREATE OR REPLACE FUNCTION public.can_view_user_post(p_author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.users me
      WHERE me.user_id = (SELECT auth.uid())
        AND p_author_id = ANY (COALESCE(me.friends, '{}'::uuid[]))
    );
$$;

DROP POLICY IF EXISTS "posts_select_feed" ON public.posts;
CREATE POLICY "posts_select_feed" ON public.posts
  FOR SELECT TO authenticated
  USING (public.can_view_user_post(user_id));

DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "post_comments_select_feed" ON public.post_comments;
CREATE POLICY "post_comments_select_feed" ON public.post_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.post_id = post_comments.post_id
        AND public.can_view_user_post(p.user_id)
    )
  );

DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
CREATE POLICY "post_comments_insert_own" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.post_id = post_comments.post_id
        AND public.can_view_user_post(p.user_id)
    )
  );

DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;
CREATE POLICY "post_comments_delete_own" ON public.post_comments
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Post images: {user_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('post', 'post', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "post_select_anon" ON storage.objects;
DROP POLICY IF EXISTS "post_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "post_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "post_update_own" ON storage.objects;
DROP POLICY IF EXISTS "post_delete_own" ON storage.objects;

CREATE POLICY "post_select_anon" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'post');

CREATE POLICY "post_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post');

CREATE POLICY "post_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post'
    AND (SELECT auth.uid())::text = split_part(name, '/', 1)
  );

CREATE POLICY "post_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'post'
    AND (SELECT auth.uid())::text = split_part(name, '/', 1)
  )
  WITH CHECK (
    bucket_id = 'post'
    AND (SELECT auth.uid())::text = split_part(name, '/', 1)
  );

CREATE POLICY "post_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post'
    AND (SELECT auth.uid())::text = split_part(name, '/', 1)
  );
