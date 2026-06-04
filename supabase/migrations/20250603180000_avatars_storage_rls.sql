-- Avatars bucket RLS: path must be {auth.uid()}/avatar.{ext}
-- Public read for profile display; write/update/delete only in own folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Remove legacy boards-bucket avatar policies if present
DROP POLICY IF EXISTS "boards_avatar_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "boards_avatar_update_own" ON storage.objects;
DROP POLICY IF EXISTS "boards_avatar_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_anon" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

-- Read (required for public URLs and for upsert replace)
CREATE POLICY "avatars_select_anon" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Write: only under own user_id folder, single avatar file per user
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = split_part(name, '/', 1)
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = split_part(name, '/', 1)
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = split_part(name, '/', 1)
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = split_part(name, '/', 1)
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );
