-- Remove legacy bigint identity `id` columns; UUID columns are the primary keys.

-- users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_id_key;
ALTER TABLE public.users DROP COLUMN IF EXISTS id;
DROP SEQUENCE IF EXISTS public.users_id_seq;
ALTER TABLE public.users ADD PRIMARY KEY (user_id);

-- boards
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_pkey;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_board_id_key;
ALTER TABLE public.boards DROP COLUMN IF EXISTS id;
DROP SEQUENCE IF EXISTS public.boards_id_seq;
ALTER TABLE public.boards ADD PRIMARY KEY (board_id);

-- media
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_pkey;
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_uid_key;
ALTER TABLE public.media DROP COLUMN IF EXISTS id;
DROP SEQUENCE IF EXISTS public.media_id_seq;
ALTER TABLE public.media ADD PRIMARY KEY (media_id);
