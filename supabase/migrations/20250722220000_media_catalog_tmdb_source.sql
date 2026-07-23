-- Allow TMDB as a catalog source (replaces RapidAPI movie_ratings for new rows)

ALTER TABLE public.media_catalog
  DROP CONSTRAINT IF EXISTS media_catalog_source_check;

ALTER TABLE public.media_catalog
  ADD CONSTRAINT media_catalog_source_check
  CHECK (source IN ('jikan', 'movie_ratings', 'tmdb'));
