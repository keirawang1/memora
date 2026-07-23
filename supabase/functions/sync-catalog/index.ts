import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';

/**
 * Batched catalog sync (diversity phases). Invoked by pg_cron every ~15 min.
 * Cursor: { jikan: {...}, tmdb: {...}, embed?: boolean }
 */

const JIKAN_GAP_MS = 1200;
const MAL_GENRES = [1, 4, 7, 8, 10, 14, 22, 24, 41];
const TMDB_GENRES = [28, 35, 18, 14, 27, 878, 53, 10749];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JikanCursor = {
  phase: string;
  page: number;
  genreIndex: number;
  seasonIndex: number;
  yearOffset: number;
};

type TmdbCursor = { phase: string; page: number; genreIndex: number };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shaShort(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function defaultJikan(): JikanCursor {
  return { phase: 'top_anime', page: 1, genreIndex: 0, seasonIndex: 0, yearOffset: 0 };
}

function defaultTmdb(): TmdbCursor {
  return { phase: 'popular_movie', page: 1, genreIndex: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tmdbKey = Deno.env.get('TMDB_API_KEY');
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: job } = await admin
      .from('recommendation_jobs')
      .select('cursor')
      .eq('id', 'sync-catalog')
      .maybeSingle();

    let jikan: JikanCursor = { ...defaultJikan(), ...((job?.cursor as { jikan?: JikanCursor })?.jikan ?? {}) };
    let tmdb: TmdbCursor = { ...defaultTmdb(), ...((job?.cursor as { tmdb?: TmdbCursor })?.tmdb ?? {}) };
    const summary: Record<string, unknown> = {};

    await admin.from('recommendation_jobs').upsert({
      id: 'sync-catalog',
      status: 'running',
      started_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    });

    // --- one Jikan step ---
    if (jikan.phase !== 'done') {
      await sleep(JIKAN_GAP_MS);
      try {
        if (jikan.phase === 'top_anime' || jikan.phase === 'top_manga') {
          const kind = jikan.phase === 'top_anime' ? 'anime' : 'manga';
          const res = await fetch(`https://api.jikan.moe/v4/top/${kind}?page=${jikan.page}`);
          if (res.ok) {
            const json = await res.json();
            const rows = await Promise.all(
              ((json.data ?? []) as Record<string, unknown>[]).map(async (item) => {
                const title =
                  (typeof item.title_english === 'string' && item.title_english) ||
                  String(item.title ?? '');
                const genres = ((item.genres as { name: string }[]) ?? []).map((g) => g.name);
                const synopsis = typeof item.synopsis === 'string' ? item.synopsis : null;
                const images = item.images as { jpg?: { large_image_url?: string } } | undefined;
                const content_hash = await shaShort(`${kind}|${title}|${synopsis ?? ''}|${genres.join(',')}`);
                return {
                  source: 'jikan',
                  external_id: String(item.mal_id),
                  media_type: kind,
                  title,
                  synopsis,
                  genres,
                  image_url: images?.jpg?.large_image_url ?? null,
                  external_url: `https://myanimelist.net/${kind}/${item.mal_id}`,
                  metadata: {},
                  content_hash,
                  updated_at: new Date().toISOString(),
                };
              }),
            );
            const unique = [...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r])).values()];
            if (unique.length) {
              await admin.from('media_catalog').upsert(unique, { onConflict: 'source,external_id' });
            }
            summary.jikan = { phase: jikan.phase, page: jikan.page, upserted: unique.length };
            if (json.pagination?.has_next_page && jikan.page < 15) jikan = { ...jikan, page: jikan.page + 1 };
            else {
              jikan =
                jikan.phase === 'top_anime'
                  ? { ...defaultJikan(), phase: 'top_manga' }
                  : { ...defaultJikan(), phase: 'genres_anime' };
            }
          } else if (res.status === 504 || res.status === 503) {
            summary.jikan = { note: res.status };
            jikan = { ...jikan, page: jikan.page + 1 };
          }
        } else if (jikan.phase === 'genres_anime' || jikan.phase === 'genres_manga') {
          const kind = jikan.phase === 'genres_anime' ? 'anime' : 'manga';
          if (jikan.genreIndex >= MAL_GENRES.length) {
            jikan = {
              ...defaultJikan(),
              phase: jikan.phase === 'genres_anime' ? 'genres_manga' : 'mid_anime',
            };
          } else {
            const gid = MAL_GENRES[jikan.genreIndex];
            const res = await fetch(
              `https://api.jikan.moe/v4/${kind}?genres=${gid}&order_by=score&sort=desc&page=${jikan.page}&limit=25`,
            );
            if (res.ok) {
              const json = await res.json();
              const rows = await Promise.all(
                ((json.data ?? []) as Record<string, unknown>[]).map(async (item) => {
                  const title = String(item.title_english || item.title || '');
                  const genres = ((item.genres as { name: string }[]) ?? []).map((g) => g.name);
                  const synopsis = typeof item.synopsis === 'string' ? item.synopsis : null;
                  const content_hash = await shaShort(`${kind}|${title}|${synopsis ?? ''}|${genres.join(',')}`);
                  return {
                    source: 'jikan',
                    external_id: String(item.mal_id),
                    media_type: kind,
                    title,
                    synopsis,
                    genres,
                    image_url:
                      (item.images as { jpg?: { large_image_url?: string } })?.jpg?.large_image_url ??
                      null,
                    external_url: `https://myanimelist.net/${kind}/${item.mal_id}`,
                    metadata: {},
                    content_hash,
                    updated_at: new Date().toISOString(),
                  };
                }),
              );
              const unique = [...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r])).values()];
              if (unique.length) {
                await admin.from('media_catalog').upsert(unique, { onConflict: 'source,external_id' });
              }
              summary.jikan = { phase: jikan.phase, genre: gid, page: jikan.page, upserted: unique.length };
              if (json.pagination?.has_next_page && jikan.page < 3) {
                jikan = { ...jikan, page: jikan.page + 1 };
              } else {
                jikan = { ...jikan, genreIndex: jikan.genreIndex + 1, page: 1 };
              }
            } else {
              jikan = { ...jikan, genreIndex: jikan.genreIndex + 1, page: 1 };
            }
          }
        } else if (jikan.phase === 'mid_anime' || jikan.phase === 'mid_manga') {
          const kind = jikan.phase === 'mid_anime' ? 'anime' : 'manga';
          if (jikan.genreIndex >= MAL_GENRES.length) {
            jikan = {
              ...defaultJikan(),
              phase: jikan.phase === 'mid_anime' ? 'mid_manga' : 'seasons',
            };
          } else {
            const gid = MAL_GENRES[jikan.genreIndex];
            const res = await fetch(
              `https://api.jikan.moe/v4/${kind}?genres=${gid}&order_by=popularity&sort=asc&min_score=7&page=${jikan.page}&limit=25`,
            );
            if (res.ok) {
              const json = await res.json();
              const rows = await Promise.all(
                ((json.data ?? []) as Record<string, unknown>[]).map(async (item) => {
                  const title = String(item.title_english || item.title || '');
                  const genres = ((item.genres as { name: string }[]) ?? []).map((g) => g.name);
                  const synopsis = typeof item.synopsis === 'string' ? item.synopsis : null;
                  const content_hash = await shaShort(`${kind}|${title}|${synopsis ?? ''}|${genres.join(',')}`);
                  return {
                    source: 'jikan',
                    external_id: String(item.mal_id),
                    media_type: kind,
                    title,
                    synopsis,
                    genres,
                    image_url:
                      (item.images as { jpg?: { large_image_url?: string } })?.jpg?.large_image_url ??
                      null,
                    external_url: `https://myanimelist.net/${kind}/${item.mal_id}`,
                    metadata: {},
                    content_hash,
                    updated_at: new Date().toISOString(),
                  };
                }),
              );
              const unique = [...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r])).values()];
              if (unique.length) {
                await admin.from('media_catalog').upsert(unique, { onConflict: 'source,external_id' });
              }
              summary.jikan = { phase: jikan.phase, genre: gid, upserted: unique.length };
              if (json.pagination?.has_next_page && jikan.page < 2) {
                jikan = { ...jikan, page: jikan.page + 1 };
              } else {
                jikan = { ...jikan, genreIndex: jikan.genreIndex + 1, page: 1 };
              }
            } else {
              jikan = { ...jikan, genreIndex: jikan.genreIndex + 1, page: 1 };
            }
          }
        } else if (jikan.phase === 'seasons') {
          const seasons = ['winter', 'spring', 'summer', 'fall'];
          if (jikan.yearOffset >= 3) {
            jikan = { ...defaultJikan(), phase: 'done' };
          } else if (jikan.seasonIndex >= seasons.length) {
            jikan = { ...jikan, yearOffset: jikan.yearOffset + 1, seasonIndex: 0, page: 1 };
          } else {
            const year = new Date().getFullYear() - jikan.yearOffset;
            const season = seasons[jikan.seasonIndex];
            const res = await fetch(
              `https://api.jikan.moe/v4/seasons/${year}/${season}?page=${jikan.page}`,
            );
            if (res.ok) {
              const json = await res.json();
              const rows = await Promise.all(
                ((json.data ?? []) as Record<string, unknown>[]).map(async (item) => {
                  const title = String(item.title_english || item.title || '');
                  const genres = ((item.genres as { name: string }[]) ?? []).map((g) => g.name);
                  const synopsis = typeof item.synopsis === 'string' ? item.synopsis : null;
                  const content_hash = await shaShort(`anime|${title}|${synopsis ?? ''}|${genres.join(',')}`);
                  return {
                    source: 'jikan',
                    external_id: String(item.mal_id),
                    media_type: 'anime',
                    title,
                    synopsis,
                    genres,
                    image_url:
                      (item.images as { jpg?: { large_image_url?: string } })?.jpg?.large_image_url ??
                      null,
                    external_url: `https://myanimelist.net/anime/${item.mal_id}`,
                    metadata: {},
                    content_hash,
                    updated_at: new Date().toISOString(),
                  };
                }),
              );
              const unique = [...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r])).values()];
              if (unique.length) {
                await admin.from('media_catalog').upsert(unique, { onConflict: 'source,external_id' });
              }
              summary.jikan = { phase: 'seasons', year, season, upserted: unique.length };
            }
            jikan = { ...jikan, seasonIndex: jikan.seasonIndex + 1, page: 1 };
          }
        } else {
          jikan = defaultJikan();
        }
      } catch (err) {
        summary.jikan_error = err instanceof Error ? err.message : String(err);
      }
    }

    // --- one TMDB step ---
    if (tmdbKey && tmdb.phase !== 'done') {
      try {
        const kind =
          tmdb.phase.includes('tv') ? 'tv' : 'movie';
        let path = '';
        if (tmdb.phase === 'popular_movie' || tmdb.phase === 'popular_tv') {
          path = `/${kind}/popular?page=${tmdb.page}&api_key=${tmdbKey}`;
        } else if (tmdb.phase === 'discover_movie' || tmdb.phase === 'discover_tv') {
          if (tmdb.genreIndex >= TMDB_GENRES.length) {
            tmdb = {
              ...defaultTmdb(),
              phase: tmdb.phase === 'discover_movie' ? 'discover_tv' : 'done',
            };
          } else {
            const gid = TMDB_GENRES[tmdb.genreIndex];
            path = `/discover/${kind}?with_genres=${gid}&sort_by=vote_average.desc&vote_count.gte=100&page=${tmdb.page}&api_key=${tmdbKey}`;
          }
        }
        if (path) {
          const res = await fetch(`https://api.themoviedb.org/3${path}`);
          if (res.ok) {
            const json = await res.json();
            const results = (json.results ?? []) as Record<string, unknown>[];
            const rows = [];
            for (const item of results) {
              const title = String(item.title || item.name || '');
              const id = item.id;
              if (!title || id == null) continue;
              const synopsis = typeof item.overview === 'string' ? item.overview : null;
              const poster = typeof item.poster_path === 'string' ? item.poster_path : null;
              const content_hash = await shaShort(`${kind}|${title}|${synopsis ?? ''}`);
              rows.push({
                source: 'tmdb',
                external_id: String(id),
                media_type: kind,
                title,
                synopsis,
                genres: [],
                image_url: poster ? `https://image.tmdb.org/t/p/w500${poster}` : null,
                external_url: `https://www.themoviedb.org/${kind}/${id}`,
                metadata: { vote_average: item.vote_average ?? null },
                content_hash,
                updated_at: new Date().toISOString(),
              });
            }
            const unique = [...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r])).values()];
            if (unique.length) {
              await admin.from('media_catalog').upsert(unique, { onConflict: 'source,external_id' });
            }
            summary.tmdb = { phase: tmdb.phase, upserted: unique.length };
            if (tmdb.phase.startsWith('popular')) {
              if (tmdb.page < 5 && results.length) tmdb = { ...tmdb, page: tmdb.page + 1 };
              else {
                tmdb =
                  tmdb.phase === 'popular_movie'
                    ? { ...defaultTmdb(), phase: 'popular_tv' }
                    : { ...defaultTmdb(), phase: 'discover_movie' };
              }
            } else {
              if (tmdb.page < 3 && results.length) tmdb = { ...tmdb, page: tmdb.page + 1 };
              else tmdb = { ...tmdb, genreIndex: tmdb.genreIndex + 1, page: 1 };
            }
          }
        }
      } catch (err) {
        summary.tmdb_error = err instanceof Error ? err.message : String(err);
      }
    } else if (!tmdbKey) {
      summary.tmdb = { skipped: 'no_tmdb_key' };
    }

    // Embeddings are free/local MiniLM via `npm run embed-catalog` (Edge has no billing APIs)
    summary.embed = { skipped: 'run_local_embed_catalog' };

    if (jikan.phase === 'done') jikan = defaultJikan();
    if (tmdb.phase === 'done') tmdb = defaultTmdb();

    await admin.from('recommendation_jobs').upsert({
      id: 'sync-catalog',
      status: 'idle',
      cursor: { jikan, tmdb },
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    });

    return new Response(JSON.stringify({ ...summary, jikan, tmdb }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
