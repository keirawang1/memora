-- Dedicated avatars bucket: {user_id}/avatar.{ext}

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "boards_avatar_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "boards_avatar_update_own" ON storage.objects;
DROP POLICY IF EXISTS "boards_avatar_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND split_part(name, '/', 2) LIKE 'avatar.%'
    AND split_part(name, '/', 3) = ''
  );

-- SELECT policies defined in 20250603180000_avatars_storage_rls.sql
