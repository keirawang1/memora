-- Switch embeddings to free local MiniLM (384-d). Clears incompatible 768-d vectors.

DROP INDEX IF EXISTS public.media_catalog_embedding_hnsw_idx;

DROP FUNCTION IF EXISTS public.match_media_catalog(
  extensions.vector(768), int, text[], text[], uuid[]
);

ALTER TABLE public.media_catalog
  ALTER COLUMN embedding TYPE extensions.vector(384)
  USING NULL;

CREATE INDEX IF NOT EXISTS media_catalog_embedding_hnsw_idx
  ON public.media_catalog
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.match_media_catalog(
  query_embedding extensions.vector(384),
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
  extensions.vector(384), int, text[], text[], uuid[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_media_catalog(
  extensions.vector(384), int, text[], text[], uuid[]
) TO service_role;
