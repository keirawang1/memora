-- Canonical profile image column on public.users (storage URL from avatars bucket)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Backfill from legacy "avatar" column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'avatar'
  ) THEN
    EXECUTE $sql$
      UPDATE public.users
      SET avatar_url = avatar
      WHERE avatar_url IS NULL AND avatar IS NOT NULL
    $sql$;
  END IF;
END $$;
