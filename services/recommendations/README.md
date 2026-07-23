# Memora recommendations worker

**Free stack:** local MiniLM embeddings (`@xenova/transformers`) + pgvector + template reasons. No Gemini / no paid APIs for recs.

## Secrets (`services/recommendations/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Settings → API → service_role |
| `TMDB_API_KEY` | movies/TV | Free from themoviedb.org |

## Jobs

```bash
npm run sync-catalog           # Jikan + TMDB metadata (resumable)
npm run sync-catalog -- --reset
npm run embed-catalog          # Local MiniLM → pgvector (downloads ~23MB model once)
npm run refresh-recs
npm run generate-user -- <userId> [--force]
```

## Diversity phases

Jikan: top → genre score → mid-popularity → seasons → user MAL neighborhoods  
TMDB: popular → discover-by-genre → similar-to-liked

## Vault (pg_cron)

```sql
select vault.create_secret('https://YOUR_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

Edge `sync-catalog` upserts metadata only; run `embed-catalog` locally (or on any free Node host) for vectors.
