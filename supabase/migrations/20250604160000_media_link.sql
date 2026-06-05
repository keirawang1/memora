ALTER TABLE public.media ADD COLUMN IF NOT EXISTS link text;

ALTER TABLE public.media
  ALTER COLUMN rating TYPE numeric(2, 1) USING rating::numeric(2, 1);
