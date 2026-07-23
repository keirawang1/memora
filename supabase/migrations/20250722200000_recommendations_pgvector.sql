-- Recommendation system: catalog embeddings + per-user cached picks

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.media_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('jikan', 'movie_ratings')),
  external_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('anime', 'manga', 'movie', 'tv')),
  title text NOT NULL,
  synopsis text,
  genres text[] NOT NULL DEFAULT '{}',
  image_url text,
  external_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding extensions.vector(768),
  content_hash text,
  embedded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS media_catalog_media_type_idx
  ON public.media_catalog (media_type);

CREATE INDEX IF NOT EXISTS media_catalog_title_lower_idx
  ON public.media_catalog (lower(title));

CREATE INDEX IF NOT EXISTS media_catalog_embedding_hnsw_idx
  ON public.media_catalog
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_recommendations (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_ids uuid[] NOT NULL DEFAULT '{}',
  input_fingerprint text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS public.recommendation_jobs (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle',
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.recommendation_jobs (id, status)
VALUES
  ('sync-catalog', 'idle'),
  ('embed-catalog', 'idle'),
  ('refresh-recs', 'idle')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.media_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_jobs ENABLE ROW LEVEL SECURITY;

-- Catalog is readable by authenticated users (discovery / add-from-rec)
CREATE POLICY "media_catalog_select_authenticated"
  ON public.media_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only read their own recommendation cache
CREATE POLICY "user_recommendations_select_own"
  ON public.user_recommendations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Jobs table is service-role only (no policies for authenticated/anon)

GRANT SELECT ON public.media_catalog TO authenticated;
GRANT SELECT ON public.user_recommendations TO authenticated;

-- Similarity search helper for candidate generation
CREATE OR REPLACE FUNCTION public.match_media_catalog(
  query_embedding extensions.vector(768),
  match_count int DEFAULT 80,
  filter_types text[] DEFAULT NULL,
  exclude_titles text[] DEFAULT NULL,
  exclude_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source text,
  external_id text,
  media_type text,
  title text,
  synopsis text,
  genres text[],
  image_url text,
  external_url text,
  metadata jsonb,
  distance float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.source,
    c.external_id,
    c.media_type,
    c.title,
    c.synopsis,
    c.genres,
    c.image_url,
    c.external_url,
    c.metadata,
    (c.embedding <=> query_embedding)::float AS distance
  FROM public.media_catalog c
  WHERE c.embedding IS NOT NULL
    AND (filter_types IS NULL OR c.media_type = ANY (filter_types))
    AND (exclude_ids IS NULL OR NOT (c.id = ANY (exclude_ids)))
    AND (
      exclude_titles IS NULL
      OR NOT (lower(c.title) = ANY (exclude_titles))
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT greatest(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.match_media_catalog(
  extensions.vector(768), int, text[], text[], uuid[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_media_catalog(
  extensions.vector(768), int, text[], text[], uuid[]
) TO service_role;
