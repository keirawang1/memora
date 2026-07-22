-- Allow sorting media by rating
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_media_sort_mode_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_media_sort_mode_check
  CHECK (media_sort_mode IN ('alphabetical', 'last_edited', 'custom', 'rating'));
