import type { DiscoveryItem } from '../types/discovery';
import { malGenresToMemora } from '../data/malGenres';

const BASE = 'https://api.jikan.moe/v4';

let lastRequestAt = 0;
const MIN_GAP_MS = 350;
/** Fail fast — Jikan gateways often hang forever before returning 504. */
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

async function jikanFetch<T>(path: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const now = Date.now();
    const wait = MIN_GAP_MS - (now - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE}${path}`, { signal: controller.signal });

      if (res.ok) {
        return (await res.json()) as T;
      }

      // 504 / 503: one quick retry then give up so fallbacks can run.
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 2500)
            : res.status === 429
              ? 1200 * (attempt + 1)
              : 600;
        lastError = new Error(`Jikan ${path}: ${res.status}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw new Error(`Jikan ${path}: ${res.status}`);
    } catch (err) {
      const aborted =
        err instanceof DOMException
          ? err.name === 'AbortError'
          : err instanceof Error && err.name === 'AbortError';
      lastError = aborted
        ? new Error(`Jikan ${path}: timeout`)
        : err instanceof Error
          ? err
          : new Error(`Jikan ${path}: failed`);

      if (aborted && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`Jikan ${path}: failed`);
}

interface JikanAnime {
  mal_id: number;
  title: string;
  type?: string;
  images?: {
    jpg?: { large_image_url?: string; image_url?: string };
  };
  genres?: { mal_id: number; name: string }[];
}

interface JikanListResponse {
  data: JikanAnime[];
}

interface JikanRecEntry {
  entry: JikanAnime;
}

interface JikanRecResponse {
  data: JikanRecEntry[];
}

function mapJikanAnime(anime: JikanAnime): DiscoveryItem {
  const genreIds = (anime.genres ?? []).map((g) => g.mal_id);
  const formatLabel = (anime.type ?? 'ANIME').toUpperCase();
  return {
    id: `mal-${anime.mal_id}`,
    externalId: anime.mal_id,
    source: 'jikan',
    title: anime.title,
    imageUrl:
      anime.images?.jpg?.large_image_url ??
      anime.images?.jpg?.image_url ??
      '',
    type: 'anime',
    genres: malGenresToMemora(genreIds),
    link: `https://myanimelist.net/anime/${anime.mal_id}`,
    formatLabel,
  };
}

function mapJikanManga(manga: JikanAnime): DiscoveryItem {
  const genreIds = (manga.genres ?? []).map((g) => g.mal_id);
  const formatLabel = (manga.type ?? 'MANGA').toUpperCase();
  return {
    id: `mal-manga-${manga.mal_id}`,
    externalId: manga.mal_id,
    source: 'jikan',
    title: manga.title,
    imageUrl:
      manga.images?.jpg?.large_image_url ??
      manga.images?.jpg?.image_url ??
      '',
    type: 'comic',
    genres: malGenresToMemora(genreIds),
    link: `https://myanimelist.net/manga/${manga.mal_id}`,
    formatLabel: formatLabel === 'MANGA' ? 'MANGA' : formatLabel,
  };
}

async function jikanFetchAnimeList(path: string, limit?: number): Promise<DiscoveryItem[]> {
  try {
    const json = await jikanFetch<JikanListResponse>(path);
    const rows = limit != null ? json.data.slice(0, limit) : json.data;
    return rows.map(mapJikanAnime);
  } catch {
    return [];
  }
}

async function jikanFetchMangaList(path: string, limit?: number): Promise<DiscoveryItem[]> {
  try {
    const json = await jikanFetch<JikanListResponse>(path);
    const rows = limit != null ? json.data.slice(0, limit) : json.data;
    return rows.map(mapJikanManga);
  } catch {
    return [];
  }
}

async function jikanFetchAnimeRecs(path: string): Promise<DiscoveryItem[]> {
  try {
    const json = await jikanFetch<JikanRecResponse>(path);
    return json.data.map((e) => mapJikanAnime(e.entry));
  } catch {
    return [];
  }
}

async function jikanFetchMangaRecs(path: string): Promise<DiscoveryItem[]> {
  try {
    const json = await jikanFetch<JikanRecResponse>(path);
    return json.data.map((e) => mapJikanManga(e.entry));
  } catch {
    return [];
  }
}

export async function jikanSeasonNow(limit = 15): Promise<DiscoveryItem[]> {
  return jikanFetchAnimeList(`/seasons/now?limit=${Math.min(limit, 25)}`, limit);
}

export async function jikanTopAnime(limit = 12): Promise<DiscoveryItem[]> {
  return jikanFetchAnimeList(`/top/anime?filter=bypopularity&limit=${limit}`);
}

export async function jikanTopAiringAnime(limit = 20): Promise<DiscoveryItem[]> {
  return jikanFetchAnimeList(`/top/anime?filter=airing&limit=${limit}`);
}

export async function jikanTopPublishingManga(limit = 20): Promise<DiscoveryItem[]> {
  return jikanFetchMangaList(`/top/manga?filter=publishing&limit=${limit}`);
}

/** Prefer list endpoints; use recommendation seeds only to fill gaps. */
export async function jikanRecentManga(limit = 25): Promise<DiscoveryItem[]> {
  const [listPool, popular] = await Promise.all([
    jikanTopPublishingManga(Math.min(limit, 25)),
    jikanTopManga(Math.min(limit, 25)),
  ]);
  const merged = dedupeMangaItems([...listPool, ...popular]);
  if (merged.length >= Math.min(5, limit)) return merged.slice(0, limit);

  const recPool = await jikanMangaFromRecommendationSeeds(limit);
  return dedupeMangaItems([...merged, ...recPool]).slice(0, limit);
}

function dedupeMangaItems(items: DiscoveryItem[]): DiscoveryItem[] {
  const seen = new Set<number>();
  const result: DiscoveryItem[] = [];
  for (const item of items) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    result.push(item);
  }
  return result;
}

/** Stable fallback when list endpoints fail — recommendations still work for this id. */
export const DEFAULT_MANGA_REC_SEED_ID = 13;
export const DEFAULT_ANIME_REC_SEED_ID = 5114;

export async function jikanRecommendations(malId: number): Promise<DiscoveryItem[]> {
  return jikanFetchAnimeRecs(`/anime/${malId}/recommendations`);
}

export async function jikanSearchAnime(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  try {
    const results = await jikanFetchAnimeList(`/anime?q=${q}&limit=1`, 1);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export async function jikanAnimeByGenres(
  genreIds: number[],
  limit = 25,
): Promise<DiscoveryItem[]> {
  if (genreIds.length === 0) return [];
  const ids = genreIds.slice(0, 3).join(',');
  return jikanFetchAnimeList(
    `/anime?genres=${ids}&order_by=popularity&sort=desc&limit=${limit}`,
    limit,
  );
}

export async function jikanTopManga(limit = 15): Promise<DiscoveryItem[]> {
  return jikanFetchMangaList(`/top/manga?filter=bypopularity&limit=${limit}`);
}

export async function jikanMangaByGenres(
  genreIds: number[],
  limit = 25,
): Promise<DiscoveryItem[]> {
  if (genreIds.length === 0) return [];
  const ids = genreIds.slice(0, 3).join(',');
  return jikanFetchMangaList(
    `/manga?genres=${ids}&order_by=popularity&sort=desc&limit=${limit}`,
    limit,
  );
}

export async function jikanMangaRecommendations(malId: number): Promise<DiscoveryItem[]> {
  return jikanFetchMangaRecs(`/manga/${malId}/recommendations`);
}

/** Well-known titles — used only when list APIs return too little. */
const MANGA_TRENDING_SEED_IDS = [13, 2, 656, 85199, 44347];

export async function jikanMangaFromRecommendationSeeds(limit = 25): Promise<DiscoveryItem[]> {
  const pool: DiscoveryItem[] = [];
  for (const malId of MANGA_TRENDING_SEED_IDS) {
    const recs = await jikanMangaRecommendations(malId);
    if (recs.length === 0) continue;
    pool.push(...recs);
    if (dedupeMangaItems(pool).length >= limit) break;
  }
  return dedupeMangaItems(pool).slice(0, limit);
}

export async function jikanSearchManga(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  try {
    const results = await jikanFetchMangaList(`/manga?q=${q}&limit=1`, 1);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

interface JikanDetailData {
  synopsis?: string;
  background?: string;
}

interface JikanDetailResponse {
  data: JikanDetailData;
}

export async function jikanFetchSynopsis(item: DiscoveryItem): Promise<string> {
  const path =
    item.type === 'comic' ? `/manga/${item.externalId}` : `/anime/${item.externalId}`;
  try {
    const json = await jikanFetch<JikanDetailResponse>(path);
    const text = json.data.synopsis?.trim() || json.data.background?.trim();
    return text || 'No overview available.';
  } catch {
    return 'No overview available.';
  }
}

export function parseMalAnimeIdFromLink(link: string | undefined): number | null {
  if (!link) return null;
  const match = link.match(/myanimelist\.net\/anime\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function parseMalMangaIdFromLink(link: string | undefined): number | null {
  if (!link) return null;
  const match = link.match(/myanimelist\.net\/manga\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

/** @deprecated use parseMalAnimeIdFromLink */
export function parseMalIdFromLink(link: string | undefined): number | null {
  return parseMalAnimeIdFromLink(link);
}
