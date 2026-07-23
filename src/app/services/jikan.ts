import type { DiscoveryItem } from '../types/discovery';
import { malGenresToMemora } from '../data/malGenres';
import { jikanMangaTypeToMemora } from '../data/printMediaTypes';

const BASE = 'https://api.jikan.moe/v4';

/** Jikan: ~3 req/s advertised; stay well under to avoid 429/504 cascades. */
const MIN_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const COOLDOWN_429_MS = 8000;

type QueueJob = {
  path: string;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const queue: QueueJob[] = [];
let pumping = false;
let lastRequestAt = 0;
let cooldownUntil = 0;

function readResponseCache<T>(path: string): T | null {
  const hit = responseCache.get(path);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(path);
    return null;
  }
  return hit.data as T;
}

function writeResponseCache(path: string, data: unknown): void {
  responseCache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function pumpQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    const cached = readResponseCache(job.path);
    if (cached != null) {
      job.resolve(cached);
      continue;
    }

    const now = Date.now();
    const waitForCooldown = Math.max(0, cooldownUntil - now);
    const waitForGap = Math.max(0, MIN_GAP_MS - (now - lastRequestAt));
    const wait = Math.max(waitForCooldown, waitForGap);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    lastRequestAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE}${job.path}`, { signal: controller.signal });

      if (res.status === 429) {
        cooldownUntil = Date.now() + COOLDOWN_429_MS;
        job.reject(new Error(`Jikan ${job.path}: 429`));
        continue;
      }

      if (res.status === 503 || res.status === 504) {
        // One short retry after cooldown — Jikan flaps on these often
        cooldownUntil = Date.now() + 2500;
        await new Promise((r) => setTimeout(r, 2500));
        lastRequestAt = Date.now();
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT_MS);
        try {
          const retry = await fetch(`${BASE}${job.path}`, { signal: retryController.signal });
          if (retry.ok) {
            const json = await retry.json();
            writeResponseCache(job.path, json);
            job.resolve(json);
            continue;
          }
        } catch {
          // fall through to reject
        } finally {
          clearTimeout(retryTimer);
        }
        job.reject(new Error(`Jikan ${job.path}: ${res.status}`));
        continue;
      }

      if (!res.ok) {
        job.reject(new Error(`Jikan ${job.path}: ${res.status}`));
        continue;
      }

      const json = await res.json();
      writeResponseCache(job.path, json);
      job.resolve(json);
    } catch (err) {
      job.reject(err);
    } finally {
      clearTimeout(timer);
    }
  }

  pumping = false;
}

function jikanFetch<T>(path: string): Promise<T> {
  const cached = readResponseCache<T>(path);
  if (cached != null) return Promise.resolve(cached);

  return new Promise<T>((resolve, reject) => {
    queue.push({
      path,
      resolve: (value) => resolve(value as T),
      reject,
    });
    void pumpQueue();
  });
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
  const memoraType = jikanMangaTypeToMemora(manga.type);
  const formatLabel = (manga.type ?? 'Manga').replace(/_/g, ' ').toUpperCase();
  return {
    id: `mal-manga-${manga.mal_id}`,
    externalId: manga.mal_id,
    source: 'jikan',
    title: manga.title,
    imageUrl:
      manga.images?.jpg?.large_image_url ??
      manga.images?.jpg?.image_url ??
      '',
    type: memoraType,
    genres: malGenresToMemora(genreIds),
    link: `https://myanimelist.net/manga/${manga.mal_id}`,
    formatLabel,
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

export async function jikanTopManga(limit = 15): Promise<DiscoveryItem[]> {
  return jikanFetchMangaList(`/top/manga?filter=bypopularity&limit=${limit}`);
}

export async function jikanTopMangaOfType(
  type: string,
  limit = 15,
): Promise<DiscoveryItem[]> {
  return jikanFetchMangaList(
    `/top/manga?type=${encodeURIComponent(type)}&filter=bypopularity&limit=${limit}`,
    limit,
  );
}

/** Popular titles across preferred print subtypes (manga / manhwa / manhua / LN). */
export async function jikanPopularPrintMix(
  jikanTypes: string[],
  limit = 25,
): Promise<DiscoveryItem[]> {
  const types = jikanTypes.length > 0 ? jikanTypes : ['manga'];
  const perType = Math.max(8, Math.ceil(limit / Math.min(types.length, 2)));
  const pool: DiscoveryItem[] = [];

  for (const type of types.slice(0, 2)) {
    let rows = await jikanTopMangaOfType(type, perType);
    if (rows.length === 0) {
      rows = await jikanFetchMangaList(
        `/manga?type=${encodeURIComponent(type)}&order_by=popularity&sort=desc&limit=${perType}`,
        perType,
      );
    }
    pool.push(...rows);
    if (pool.length >= limit) break;
  }

  if (pool.length === 0) return jikanTopManga(limit);

  const seen = new Set<number>();
  const result: DiscoveryItem[] = [];
  for (const item of pool) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

/** Single list call — no seeded rec fan-out. */
export async function jikanRecentManga(limit = 25): Promise<DiscoveryItem[]> {
  const publishing = await jikanTopPublishingManga(limit);
  if (publishing.length > 0) return publishing;
  return jikanTopManga(limit);
}

export const DEFAULT_MANGA_REC_SEED_ID = 13;
export const DEFAULT_ANIME_REC_SEED_ID = 5114;

export async function jikanRecommendations(malId: number): Promise<DiscoveryItem[]> {
  return jikanFetchAnimeRecs(`/anime/${malId}/recommendations`);
}

export async function jikanMangaRecommendations(malId: number): Promise<DiscoveryItem[]> {
  return jikanFetchMangaRecs(`/manga/${malId}/recommendations`);
}

export async function jikanSearchAnime(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  const results = await jikanFetchAnimeList(`/anime?q=${q}&limit=1`, 1);
  return results[0] ?? null;
}

export async function jikanSearchManga(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  const results = await jikanFetchMangaList(`/manga?q=${q}&limit=1`, 1);
  return results[0] ?? null;
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

/** Kept for callers — one seed only, no multi-id blast. */
export async function jikanMangaFromRecommendationSeeds(limit = 25): Promise<DiscoveryItem[]> {
  return jikanMangaRecommendations(DEFAULT_MANGA_REC_SEED_ID).then((rows) =>
    rows.slice(0, limit),
  );
}

interface JikanDetailData {
  synopsis?: string;
  background?: string;
}

interface JikanDetailResponse {
  data: JikanDetailData;
}

export async function jikanFetchSynopsis(item: DiscoveryItem): Promise<string> {
  if (item.source !== 'jikan' || !item.externalId) {
    return 'No overview available.';
  }
  const path =
    item.type === 'anime' ? `/anime/${item.externalId}` : `/manga/${item.externalId}`;
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
