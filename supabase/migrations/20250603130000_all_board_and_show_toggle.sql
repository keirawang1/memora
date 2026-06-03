ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_all_board boolean NOT NULL DEFAULT true;

UPDATE public.boards SET is_system = true WHERE name = 'All' AND is_system = false;

CREATE UNIQUE INDEX IF NOT EXISTS boards_one_system_per_user
  ON public.boards (user_id)
  WHERE is_system = true;
