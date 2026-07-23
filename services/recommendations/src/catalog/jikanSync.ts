import type { CatalogUpsertRow } from '../types.js';
import { contentHash, sleep } from '../lib/utils.js';
import { getServiceClient, markJob } from '../lib/supabase.js';
import { upsertCatalogRows } from './upsert.js';
import { HIGH_RATING_THRESHOLD } from '../types.js';

const BASE = 'https://api.jikan.moe/v4';
const MIN_GAP_MS = 1200;
const MAX_RETRIES = 5;
const TOP_PAGES = 15;
const GENRE_PAGES = 3;
const MID_PAGES = 2;
const SEASON_YEARS_BACK = 4;
const NEIGHBORHOOD_LIMIT = 40;

/** Core MAL genre IDs for diversity sweeps */
const MAL_GENRE_IDS = [1, 4, 7, 8, 10, 14, 22, 24, 36, 37, 41];

const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;

let lastRequestAt = 0;

export type JikanPhase =
  | 'top_anime'
  | 'top_manga'
  | 'genres_anime'
  | 'genres_manga'
  | 'mid_anime'
  | 'mid_manga'
  | 'seasons'
  | 'user_neighborhood'
  | 'done';

export interface JikanCursor {
  phase: JikanPhase;
  page: number;
  genreIndex: number;
  seasonIndex: number;
  yearOffset: number;
}

export function defaultJikanCursor(): JikanCursor {
  return {
    phase: 'top_anime',
    page: 1,
    genreIndex: 0,
    seasonIndex: 0,
    yearOffset: 0,
  };
}

interface JikanItem {
  mal_id: number;
  title: string;
  title_english?: string | null;
  synopsis?: string | null;
  type?: string | null;
  score?: number | null;
  year?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  url?: string;
  images?: {
    jpg?: { large_image_url?: string; image_url?: string };
  };
  genres?: { name: string }[];
  themes?: { name: string }[];
  demographics?: { name: string }[];
  entry?: JikanItem;
}

interface JikanPage {
  data: JikanItem[] | { entry: JikanItem }[];
  pagination?: {
    last_visible_page?: number;
    has_next_page?: boolean;
  };
}

async function jikanGet(path: string, attempt = 1): Promise<JikanPage> {
  const now = Date.now();
  const wait = Math.max(0, MIN_GAP_MS - (now - lastRequestAt));
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const backoff = 2000 * attempt;
      console.warn(`[jikan] network error on ${path}, retry ${attempt}/${MAX_RETRIES}`);
      await sleep(backoff);
      return jikanGet(path, attempt + 1);
    }
    throw err;
  }

  if (res.status === 429 || res.status === 503 || res.status === 504) {
    if (attempt < MAX_RETRIES) {
      const backoff = res.status === 429 ? 10000 * attempt : 4000 * attempt;
      console.warn(`[jikan] ${res.status} on ${path}, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`);
      await sleep(backoff);
      return jikanGet(path, attempt + 1);
    }
    throw new Error(`Jikan ${path}: ${res.status} after ${MAX_RETRIES} retries`);
  }

  if (!res.ok) {
    throw new Error(`Jikan ${path}: ${res.status}`);
  }
  return (await res.json()) as JikanPage;
}

function toCatalogRow(item: JikanItem, mediaType: 'anime' | 'manga'): CatalogUpsertRow {
  const genres = [
    ...(item.genres ?? []),
    ...(item.themes ?? []),
    ...(item.demographics ?? []),
  ].map((g) => g.name);

  const synopsis = item.synopsis?.trim() || null;
  const title = (item.title_english?.trim() || item.title).trim();
  const row = {
    source: 'jikan' as const,
    external_id: String(item.mal_id),
    media_type: mediaType,
    title,
    synopsis,
    genres,
    image_url:
      item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url ?? null,
    external_url: item.url ?? `https://myanimelist.net/${mediaType}/${item.mal_id}`,
    metadata: {
      score: item.score ?? null,
      year: item.year ?? null,
      episodes: item.episodes ?? null,
      chapters: item.chapters ?? null,
      mal_type: item.type ?? null,
    },
    content_hash: '',
  };
  row.content_hash = contentHash(row);
  return row;
}

function asItems(data: JikanPage['data']): JikanItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    if (row && typeof row === 'object' && 'entry' in row && (row as { entry: JikanItem }).entry) {
      return (row as { entry: JikanItem }).entry;
    }
    return row as JikanItem;
  });
}

async function upsertFromPath(
  path: string,
  mediaType: 'anime' | 'manga',
): Promise<{ count: number; hasNext: boolean }> {
  const json = await jikanGet(path);
  const rows = asItems(json.data)
    .filter((i) => i?.mal_id && i?.title)
    .map((item) => toCatalogRow(item, mediaType));
  const count = await upsertCatalogRows(rows);
  return { count, hasNext: Boolean(json.pagination?.has_next_page) };
}

function nextPhase(phase: JikanPhase): JikanPhase {
  const order: JikanPhase[] = [
    'top_anime',
    'top_manga',
    'genres_anime',
    'genres_manga',
    'mid_anime',
    'mid_manga',
    'seasons',
    'user_neighborhood',
    'done',
  ];
  const i = order.indexOf(phase);
  return order[Math.min(i + 1, order.length - 1)];
}

async function syncUserNeighborhood(): Promise<number> {
  const sb = getServiceClient();
  const { data: media, error } = await sb
    .from('media')
    .select('title, type, link, rating')
    .gt('rating', HIGH_RATING_THRESHOLD)
    .limit(80);
  if (error) throw error;

  const seeds: { id: string; kind: 'anime' | 'manga' }[] = [];
  for (const row of media ?? []) {
    const link = (row as { link?: string | null }).link ?? '';
    const type = String((row as { type?: string }).type ?? '').toLowerCase();
    const anime = link.match(/myanimelist\.net\/anime\/(\d+)/i);
    const manga = link.match(/myanimelist\.net\/manga\/(\d+)/i);
    if (anime) seeds.push({ id: anime[1], kind: 'anime' });
    else if (manga) seeds.push({ id: manga[1], kind: 'manga' });
    else if (type === 'anime' || type === 'manga') {
      // Resolve by title search once
      try {
        const q = encodeURIComponent(String((row as { title: string }).title));
        const path =
          type === 'anime'
            ? `/anime?q=${q}&limit=1`
            : `/manga?q=${q}&limit=1`;
        const json = await jikanGet(path);
        const first = asItems(json.data)[0];
        if (first?.mal_id) seeds.push({ id: String(first.mal_id), kind: type as 'anime' | 'manga' });
      } catch (err) {
        console.warn('[jikan] title resolve failed', err);
      }
    }
    if (seeds.length >= NEIGHBORHOOD_LIMIT) break;
  }

  // Dedupe seeds
  const unique = [...new Map(seeds.map((s) => [`${s.kind}:${s.id}`, s])).values()];
  let upserted = 0;
  for (const seed of unique.slice(0, NEIGHBORHOOD_LIMIT)) {
    try {
      const { count } = await upsertFromPath(
        `/${seed.kind}/${seed.id}/recommendations`,
        seed.kind,
      );
      upserted += count;
      console.log(`[jikan] neighborhood ${seed.kind}/${seed.id}: +${count}`);
    } catch (err) {
      console.warn(`[jikan] neighborhood skip ${seed.kind}/${seed.id}`, err);
    }
  }
  return upserted;
}

/**
 * Run one or more Jikan sync steps. When maxSteps is set, stop after that many
 * successful page fetches (for Edge batching). Persists cursor on recommendation_jobs.
 */
export async function syncJikanCatalog(
  opts: { maxSteps?: number; reset?: boolean } = {},
): Promise<{ upserted: number; cursor: JikanCursor }> {
  const sb = getServiceClient();
  const { data: job } = await sb
    .from('recommendation_jobs')
    .select('cursor')
    .eq('id', 'sync-catalog')
    .maybeSingle();

  let cursor: JikanCursor = opts.reset
    ? defaultJikanCursor()
    : {
        ...defaultJikanCursor(),
        ...((job?.cursor as { jikan?: JikanCursor } | null)?.jikan ??
          (job?.cursor as JikanCursor | null) ??
          {}),
      };

  // Normalize if cursor from old job shape
  if (!cursor.phase) cursor = defaultJikanCursor();

  let upserted = 0;
  let steps = 0;
  const maxSteps = opts.maxSteps ?? Number.POSITIVE_INFINITY;

  while (cursor.phase !== 'done' && steps < maxSteps) {
    try {
      if (cursor.phase === 'top_anime' || cursor.phase === 'top_manga') {
        const kind = cursor.phase === 'top_anime' ? 'anime' : 'manga';
        const { count, hasNext } = await upsertFromPath(
          `/top/${kind}?page=${cursor.page}`,
          kind,
        );
        upserted += count;
        steps += 1;
        console.log(`[jikan] ${cursor.phase} page ${cursor.page}: +${count}`);
        if (hasNext && cursor.page < TOP_PAGES) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1, genreIndex: 0 };
        }
      } else if (cursor.phase === 'genres_anime' || cursor.phase === 'genres_manga') {
        const kind = cursor.phase === 'genres_anime' ? 'anime' : 'manga';
        if (cursor.genreIndex >= MAL_GENRE_IDS.length) {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1, genreIndex: 0 };
          continue;
        }
        const genreId = MAL_GENRE_IDS[cursor.genreIndex];
        const { count, hasNext } = await upsertFromPath(
          `/${kind}?genres=${genreId}&order_by=score&sort=desc&page=${cursor.page}&limit=25`,
          kind,
        );
        upserted += count;
        steps += 1;
        console.log(
          `[jikan] ${cursor.phase} genre=${genreId} page ${cursor.page}: +${count}`,
        );
        if (hasNext && cursor.page < GENRE_PAGES) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = {
            ...cursor,
            genreIndex: cursor.genreIndex + 1,
            page: 1,
          };
        }
      } else if (cursor.phase === 'mid_anime' || cursor.phase === 'mid_manga') {
        const kind = cursor.phase === 'mid_anime' ? 'anime' : 'manga';
        if (cursor.genreIndex >= MAL_GENRE_IDS.length) {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1, genreIndex: 0 };
          continue;
        }
        const genreId = MAL_GENRE_IDS[cursor.genreIndex];
        const { count, hasNext } = await upsertFromPath(
          `/${kind}?genres=${genreId}&order_by=popularity&sort=asc&min_score=7&page=${cursor.page}&limit=25`,
          kind,
        );
        upserted += count;
        steps += 1;
        console.log(
          `[jikan] ${cursor.phase} genre=${genreId} page ${cursor.page}: +${count}`,
        );
        if (hasNext && cursor.page < MID_PAGES) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = { ...cursor, genreIndex: cursor.genreIndex + 1, page: 1 };
        }
      } else if (cursor.phase === 'seasons') {
        const year = new Date().getFullYear() - cursor.yearOffset;
        if (cursor.yearOffset >= SEASON_YEARS_BACK) {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1 };
          continue;
        }
        if (cursor.seasonIndex >= SEASONS.length) {
          cursor = {
            ...cursor,
            yearOffset: cursor.yearOffset + 1,
            seasonIndex: 0,
            page: 1,
          };
          continue;
        }
        const season = SEASONS[cursor.seasonIndex];
        const { count, hasNext } = await upsertFromPath(
          `/seasons/${year}/${season}?page=${cursor.page}`,
          'anime',
        );
        upserted += count;
        steps += 1;
        console.log(`[jikan] seasons ${year}/${season} page ${cursor.page}: +${count}`);
        if (hasNext && cursor.page < 3) {
          cursor = { ...cursor, page: cursor.page + 1 };
        } else {
          cursor = { ...cursor, seasonIndex: cursor.seasonIndex + 1, page: 1 };
        }
      } else if (cursor.phase === 'user_neighborhood') {
        const count = await syncUserNeighborhood();
        upserted += count;
        steps += 1;
        cursor = { ...cursor, phase: 'done' };
      }
    } catch (err) {
      console.warn(`[jikan] step failed (${cursor.phase}):`, err);
      // Advance past stuck page to avoid infinite loops; persist and exit this run
      if (cursor.phase.startsWith('top_') || cursor.phase.startsWith('genres_') || cursor.phase.startsWith('mid_')) {
        cursor = { ...cursor, page: cursor.page + 1 };
        if (cursor.page > TOP_PAGES) {
          cursor = { ...cursor, phase: nextPhase(cursor.phase), page: 1 };
        }
      } else if (cursor.phase === 'seasons') {
        cursor = { ...cursor, seasonIndex: cursor.seasonIndex + 1, page: 1 };
      } else {
        cursor = { ...cursor, phase: nextPhase(cursor.phase) };
      }
      break;
    }

    // Persist cursor after each step (merge with tmdb)
    const { data: curJob } = await sb
      .from('recommendation_jobs')
      .select('cursor')
      .eq('id', 'sync-catalog')
      .maybeSingle();
    const tmdb = (curJob?.cursor as { tmdb?: unknown } | null)?.tmdb;
    await markJob('sync-catalog', {
      cursor: { jikan: cursor, tmdb },
      status: 'running',
    });
  }

  // When finished a full cycle, reset for next weekly-style run
  if (cursor.phase === 'done') {
    console.log('[jikan] cycle complete — resetting cursor for next run');
    cursor = defaultJikanCursor();
    const { data: curJob } = await sb
      .from('recommendation_jobs')
      .select('cursor')
      .eq('id', 'sync-catalog')
      .maybeSingle();
    const tmdb = (curJob?.cursor as { tmdb?: unknown } | null)?.tmdb;
    await markJob('sync-catalog', { cursor: { jikan: cursor, tmdb } });
  }

  return { upserted, cursor };
}
