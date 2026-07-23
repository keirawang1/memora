import type { CatalogUpsertRow } from '../types.js';
import { contentHash, sleep } from '../lib/utils.js';
import { getServiceClient, markJob } from '../lib/supabase.js';
import { upsertCatalogRows } from './upsert.js';
import { HIGH_RATING_THRESHOLD } from '../types.js';

const TMDB = 'https://api.themoviedb.org/3';
const POPULAR_PAGES = 5;
const DISCOVER_PAGES = 3;
const SIMILAR_LIMIT = 30;

/** TMDB genre ids (movie/tv share many common ones) */
const TMDB_GENRES = [28, 12, 16, 35, 80, 18, 14, 27, 9648, 10749, 878, 53];

export type TmdbPhase =
  | 'popular_movie'
  | 'popular_tv'
  | 'discover_movie'
  | 'discover_tv'
  | 'user_similar'
  | 'done';

export interface TmdbCursor {
  phase: TmdbPhase;
  page: number;
  genreIndex: number;
}

export function defaultTmdbCursor(): TmdbCursor {
  return { phase: 'popular_movie', page: 1, genreIndex: 0 };
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('Missing TMDB_API_KEY');
  return key;
}

async function tmdbGet(path: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TMDB}${path}${sep}api_key=${apiKey()}`;
  const res = await fetch(url);
  if (res.status === 429) {
    await sleep(5000);
    return tmdbGet(path);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function genresFromIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const map: Record<number, string> = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
    10759: 'Action',
    10765: 'Sci-Fi',
  };
  return ids.map((id) => map[Number(id)] ?? String(id)).filter(Boolean);
}

function toCatalogRow(
  item: Record<string, unknown>,
  mediaType: 'movie' | 'tv',
): CatalogUpsertRow | null {
  const id = item.id;
  const title =
    (typeof item.title === 'string' && item.title) ||
    (typeof item.name === 'string' && item.name) ||
    null;
  if (id == null || !title) return null;

  const synopsis =
    typeof item.overview === 'string' && item.overview.trim()
      ? item.overview.trim()
      : null;
  const poster = typeof item.poster_path === 'string' ? item.poster_path : null;
  const genres = genresFromIds(item.genre_ids);
  const row: CatalogUpsertRow = {
    source: 'tmdb',
    external_id: String(id),
    media_type: mediaType,
    title,
    synopsis,
    genres,
    image_url: poster ? `https://image.tmdb.org/t/p/w500${poster}` : null,
    external_url: `https://www.themoviedb.org/${mediaType}/${id}`,
    metadata: {
      vote_average: item.vote_average ?? null,
      release_date: item.release_date ?? item.first_air_date ?? null,
      popularity: item.popularity ?? null,
    },
    content_hash: '',
  };
  row.content_hash = contentHash(row);
  return row;
}

function nextPhase(phase: TmdbPhase): TmdbPhase {
  const order: TmdbPhase[] = [
    'popular_movie',
    'popular_tv',
    'discover_movie',
    'discover_tv',
    'user_similar',
    'done',
  ];
  const i = order.indexOf(phase);
  return order[Math.min(i + 1, order.length - 1)];
}

async function syncUserSimilar(): Promise<number> {
  const sb = getServiceClient();
  const { data: media, error } = await sb
    .from('media')
    .select('title, type, link, rating')
    .gt('rating', HIGH_RATING_THRESHOLD)
    .limit(60);
  if (error) throw error;

  const seeds: { id: string; kind: 'movie' | 'tv' }[] = [];
  for (const row of media ?? []) {
    const link = (row as { link?: string | null }).link ?? '';
    const type = String((row as { type?: string }).type ?? '').toLowerCase();
    const tmdb = link.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
    if (tmdb) {
      seeds.push({ id: tmdb[2], kind: tmdb[1] as 'movie' | 'tv' });
    } else if (type === 'movie' || type === 'tv') {
      try {
        const q = encodeURIComponent(String((row as { title: string }).title));
        const path =
          type === 'movie'
            ? `/search/movie?query=${q}&page=1`
            : `/search/tv?query=${q}&page=1`;
        const json = await tmdbGet(path);
        const results = (json.results as Record<string, unknown>[]) ?? [];
        if (results[0]?.id != null) {
          seeds.push({ id: String(results[0].id), kind: type as 'movie' | 'tv' });
        }
      } catch (err) {
        console.warn('[tmdb] search resolve failed', err);
      }
    }
    if (seeds.length >= SIMILAR_LIMIT) break;
  }

  const unique = [...new Map(seeds.map((s) => [`${s.kind}:${s.id}`, s])).values()];
  let upserted = 0;
  for (const seed of unique.slice(0, SIMILAR_LIMIT)) {
    try {
      const json = await tmdbGet(`/${seed.kind}/${seed.id}/similar?page=1`);
      const results = (json.results as Record<string, unknown>[]) ?? [];
      const rows = results
        .map((item) => toCatalogRow(item, seed.kind))
        .filter((r): r is CatalogUpsertRow => r != null);
      upserted += await upsertCatalogRows(rows);
      console.log(`[tmdb] similar ${seed.kind}/${seed.id}: +${rows.length}`);
      await sleep(250);
    } catch (err) {
      console.warn(`[tmdb] similar skip ${seed.kind}/${seed.id}`, err);
    }
  }
  return upserted;
}

export async function syncTmdbCatalog(
  opts: { maxSteps?: number; reset?: boolean } = {},
): Promise<{ upserted: number; cursor: TmdbCursor; skipped?: string }> {
  if (!process.env.TMDB_API_KEY) {
    console.warn('[tmdb] TMDB_API_KEY missing — skipping movie/TV sync');
    return { upserted: 0, cursor: defaultTmdbCursor(), skipped: 'no_tmdb_key' };
  }

  const sb = getServiceClient();
  const { data: job } = await sb
    .from('recommendation_jobs')
    .select('cursor')
    .eq('id', 'sync-catalog')
    .maybeSingle();

  const existing = (job?.cursor as { tmdb?: TmdbCursor; jikan?: unknown } | null) ?? {};
  let cursor: TmdbCursor = opts.reset
    ? defaultTmdbCursor()
    : { ...defaultTmdbCursor(), ...(existing.tmdb ?? {}) };
  if (!cursor.phase) cursor = defaultTmdbCursor();

  let upserted = 0;
  let steps = 0;
  const maxSteps = opts.maxSteps ?? Number.POSITIVE_INFINITY;

  while (cursor.phase !== 'done' && steps < maxSteps) {
    try {
      if (cursor.phase === 'popular_movie' || cursor.phase === 'popular_tv') {
        const kind = cursor.phase === 'popular_movie' ? 'movie' : 'tv';
        const json = await tmdbGet(`/${kind}/popular?page=${cursor.page}`);
        const results = (json.results as Record<string, unknown>[]) ?? [];
        const rows = results
          .map((item) => toCatalogRow(item, kind))
          .filter((r): r is CatalogUpsertRow => r != null);
        upserted += await upsertCatalogRows(rows);
        steps += 1;
        console.log(`[tmdb] ${cursor.phase} page ${cursor.page}: +${rows.length}`);
        if (cursor.page < POPULAR_PAGES && results.length > 0) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1, genreIndex: 0 };
        }
      } else if (cursor.phase === 'discover_movie' || cursor.phase === 'discover_tv') {
        const kind = cursor.phase === 'discover_movie' ? 'movie' : 'tv';
        if (cursor.genreIndex >= TMDB_GENRES.length) {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1, genreIndex: 0 };
          continue;
        }
        const genreId = TMDB_GENRES[cursor.genreIndex];
        const json = await tmdbGet(
          `/discover/${kind}?with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=100&page=${cursor.page}`,
        );
        const results = (json.results as Record<string, unknown>[]) ?? [];
        const rows = results
          .map((item) => toCatalogRow(item, kind))
          .filter((r): r is CatalogUpsertRow => r != null);
        upserted += await upsertCatalogRows(rows);
        steps += 1;
        console.log(
          `[tmdb] ${cursor.phase} genre=${genreId} page ${cursor.page}: +${rows.length}`,
        );
        if (cursor.page < DISCOVER_PAGES && results.length > 0) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = { ...cursor, genreIndex: cursor.genreIndex + 1, page: 1 };
        }
      } else if (cursor.phase === 'user_similar') {
        const count = await syncUserSimilar();
        upserted += count;
        steps += 1;
        cursor = { ...cursor, phase: 'done' };
      }
    } catch (err) {
      console.warn(`[tmdb] step failed (${cursor.phase}):`, err);
      cursor = { ...cursor, page: cursor.page + 1 };
      if (cursor.page > POPULAR_PAGES + 2) {
        cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1 };
      }
      break;
    }

    await markJob('sync-catalog', {
      status: 'running',
      cursor: { ...existing, jikan: (existing as { jikan?: unknown }).jikan, tmdb: cursor },
    });
  }

  if (cursor.phase === 'done') {
    console.log('[tmdb] cycle complete — resetting cursor for next run');
    cursor = defaultTmdbCursor();
  }

  // Re-read jikan from DB to avoid clobbering
  const { data: job2 } = await sb
    .from('recommendation_jobs')
    .select('cursor')
    .eq('id', 'sync-catalog')
    .maybeSingle();
  const jikan = (job2?.cursor as { jikan?: unknown } | null)?.jikan;
  await markJob('sync-catalog', {
    cursor: { jikan, tmdb: cursor },
  });

  return { upserted, cursor };
}

/** @deprecated use syncTmdbCatalog */
export async function syncMovieRatingsCatalog(): Promise<{ upserted: number }> {
  const result = await syncTmdbCatalog();
  return { upserted: result.upserted };
}
