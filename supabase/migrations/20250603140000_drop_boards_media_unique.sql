-- Many boards can reference the same media_id set (e.g. All vs user boards).
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_media_key;
