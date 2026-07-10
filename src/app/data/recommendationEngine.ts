import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed, DiscoverySectionRows } from '../types/discovery';
import { normalizeWatchStatus } from './analytics';
import { memoraGenresToMal } from './malGenres';
import { readLookupCache, writeLookupCache } from './discoveryCache';
import {
  jikanRecommendations,
  jikanMangaRecommendations,
  jikanAnimeByGenres,
  jikanSearchAnime,
  jikanSearchManga,
  jikanSeasonNow,
  jikanTopAiringAnime,
  jikanRecentManga,
  jikanMangaFromRecommendationSeeds,
  jikanTopPublishingManga,
  jikanMangaByGenres,
  DEFAULT_MANGA_REC_SEED_ID,
  DEFAULT_ANIME_REC_SEED_ID,
  parseMalAnimeIdFromLink,
  parseMalMangaIdFromLink,
} from '../services/jikan';

const ROW_COUNT = 5;

const MIN_ACTIVE_ITEMS = 5;
const MIN_GENRE_TAGGED_ITEMS = 3;

export function hasEnoughPersonalizationData(items: MediaItem[]): boolean {
  const active = items.filter((item) => {
    const status = normalizeWatchStatus(item.status);
    return status === 'completed' || status === 'in-progress';
  });
  const withGenres = active.filter((item) => item.genre.some((g) => g.trim()));
  return withGenres.length >= MIN_GENRE_TAGGED_ITEMS || active.length >= MIN_ACTIVE_ITEMS;
}

export function resolveRecommendationGenres(
  items: MediaItem[],
  preferredGenres: string[] = [],
): string[] {
  const weighted = computeWeightedGenres(items);
  if (weighted.length > 0) {
    return weighted.slice(0, 5).map((g) => g.name);
  }
  return preferredGenres.slice(0, 5);
}

export function isPersonalizedRecommendations(
  items: MediaItem[],
  preferredGenres: string[] = [],
): boolean {
  return hasEnoughPersonalizationData(items) || preferredGenres.length > 0;
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function computeWeightedGenres(items: MediaItem[]): { name: string; score: number }[] {
  const scores = new Map<string, { name: string; score: number }>();

  for (const item of items) {
    const status = normalizeWatchStatus(item.status);
    if (status !== 'completed' && status !== 'in-progress') continue;

    const weight = item.rating && item.rating > 0 ? item.rating : 3;
    for (const raw of item.genre) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = scores.get(key);
      if (existing) {
        existing.score += weight;
      } else {
        scores.set(key, { name, score: weight });
      }
    }
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

function sortByEngagement(a: MediaItem, b: MediaItem): number {
  const ratingA = a.rating && a.rating > 0 ? a.rating : 3;
  const ratingB = b.rating && b.rating > 0 ? b.rating : 3;
  if (ratingB !== ratingA) return ratingB - ratingA;
  const dateA = a.dateCompleted ?? a.dateAdded;
  const dateB = b.dateCompleted ?? b.dateAdded;
  return dateB.localeCompare(dateA);
}

export function pickSeedItem(items: MediaItem[]): MediaItem | null {
  const completed = items.filter(
    (item) => normalizeWatchStatus(item.status) === 'completed',
  );
  if (completed.length === 0) return null;

  return completed.sort(sortByEngagement)[0];
}

function pickSeedItemForMediaType(
  items: MediaItem[],
  mediaType: 'anime' | 'comic',
): MediaItem | null {
  const completed = items.filter((item) => {
    if (normalizeWatchStatus(item.status) !== 'completed') return false;
    return mediaType === 'anime' ? isAnimeType(item.type) : isComicType(item.type);
  });
  if (completed.length === 0) return null;
  return completed.sort(sortByEngagement)[0];
}

function isAnimeType(type: string): boolean {
  return type.trim().toLowerCase() === 'anime';
}

function isComicType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t === 'comic' || t === 'manga';
}

export async function resolveExternalId(
  item: MediaItem,
  lookupCache: Map<string, number | null>,
): Promise<{ externalId: number; mediaType: 'anime' | 'comic' } | null> {
  const cacheKey = `${item.type}:${normalizeTitle(item.title)}`;

  const persisted = readLookupCache(cacheKey);
  if (persisted !== undefined) {
    lookupCache.set(cacheKey, persisted);
    if (persisted == null) return null;
    return {
      externalId: persisted,
      mediaType: isComicType(item.type) ? 'comic' : 'anime',
    };
  }

  if (lookupCache.has(cacheKey)) {
    const cached = lookupCache.get(cacheKey);
    if (cached == null) return null;
    return {
      externalId: cached,
      mediaType: isComicType(item.type) ? 'comic' : 'anime',
    };
  }

  if (isComicType(item.type)) {
    const fromLink = parseMalMangaIdFromLink(item.link);
    if (fromLink) {
      lookupCache.set(cacheKey, fromLink);
      writeLookupCache(cacheKey, fromLink);
      return { externalId: fromLink, mediaType: 'comic' };
    }
    const found = await jikanSearchManga(item.title);
    const id = found?.externalId ?? null;
    lookupCache.set(cacheKey, id);
    writeLookupCache(cacheKey, id);
    return id ? { externalId: id, mediaType: 'comic' } : null;
  }

  if (isAnimeType(item.type)) {
    const fromLink = parseMalAnimeIdFromLink(item.link);
    if (fromLink) {
      lookupCache.set(cacheKey, fromLink);
      writeLookupCache(cacheKey, fromLink);
      return { externalId: fromLink, mediaType: 'anime' };
    }
    const found = await jikanSearchAnime(item.title);
    const id = found?.externalId ?? null;
    lookupCache.set(cacheKey, id);
    writeLookupCache(cacheKey, id);
    return id ? { externalId: id, mediaType: 'anime' } : null;
  }

  lookupCache.set(cacheKey, null);
  writeLookupCache(cacheKey, null);
  return null;
}

export function buildDiscoverySeed(
  item: MediaItem,
  resolved: { externalId: number; mediaType: 'anime' | 'comic' } | null,
): DiscoverySeed {
  return {
    mediaId: item.id,
    title: item.title,
    type: item.type,
    externalId: resolved?.externalId ?? null,
    source: resolved ? 'jikan' : null,
  };
}

export function dedupeDiscoveryItems(items: DiscoveryItem[]): DiscoveryItem[] {
  const seen = new Set<string>();
  const result: DiscoveryItem[] = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function buildRecommendedCacheKey(
  items: MediaItem[],
  seed: DiscoverySeed | null,
  topGenres: string[],
  typeWeights: Record<string, number>,
  preferredGenres: string[] = [],
): string {
  const personalized = isPersonalizedRecommendations(items, preferredGenres);
  const parts = [
    personalized ? 'personalized' : 'general',
    'v4recs',
    seed?.mediaId ?? 'none',
    topGenres.slice(0, 5).join(','),
    Object.entries(typeWeights)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(','),
  ];
  return parts.join('|');
}

export function computeTypeWeights(items: MediaItem[]): Record<string, number> {
  const weights: Record<string, number> = { anime: 0, comic: 0 };
  for (const item of items) {
    const status = normalizeWatchStatus(item.status);
    if (status === 'not-started' || status === 'dropped') continue;
    const t = item.type.trim().toLowerCase();
    if (t === 'anime') weights.anime += 1;
    else if (t === 'comic' || t === 'manga') weights.comic += 1;
  }
  if (weights.anime + weights.comic === 0) return { anime: 1, comic: 1 };
  return weights;
}

export function excludeByTitle(
  candidates: DiscoveryItem[],
  exclude: DiscoveryItem[],
): DiscoveryItem[] {
  if (exclude.length === 0) return candidates;
  const excludeTitles = new Set(exclude.map((i) => normalizeTitle(i.title)));
  return candidates.filter((i) => !excludeTitles.has(normalizeTitle(i.title)));
}

function takeUniqueItems(
  pool: DiscoveryItem[],
  count: number,
  taken: Set<string>,
  library: MediaItem[],
): DiscoveryItem[] {
  const libraryTitles = new Set(library.map((m) => normalizeTitle(m.title)));
  const result: DiscoveryItem[] = [];
  for (const item of pool) {
    if (result.length >= count) break;
    const key = normalizeTitle(item.title);
    if (taken.has(key) || libraryTitles.has(key)) continue;
    taken.add(key);
    result.push(item);
  }
  return result;
}

async function defaultRecommendationMalId(
  mediaType: 'anime' | 'comic',
): Promise<number | null> {
  if (mediaType === 'anime') {
    const [season, airing] = await Promise.all([
      jikanSeasonNow(1),
      jikanTopAiringAnime(1),
    ]);
    return season[0]?.externalId ?? airing[0]?.externalId ?? DEFAULT_ANIME_REC_SEED_ID;
  }

  const publishing = await jikanRecentManga(1);
  return publishing[0]?.externalId ?? DEFAULT_MANGA_REC_SEED_ID;
}

async function fetchV4Recommendations(
  malId: number,
  mediaType: 'anime' | 'comic',
): Promise<DiscoveryItem[]> {
  return mediaType === 'comic'
    ? jikanMangaRecommendations(malId)
    : jikanRecommendations(malId);
}

async function fetchRecommendationsForSeed(
  seedItem: MediaItem | null,
  lookupCache: Map<string, number | null>,
  mediaType: 'anime' | 'comic',
): Promise<DiscoveryItem[]> {
  let malId: number | null = null;

  if (seedItem) {
    const resolved = await resolveExternalId(seedItem, lookupCache);
    if (resolved) {
      malId = resolved.externalId;
    }
  }

  if (malId == null) {
    malId = await defaultRecommendationMalId(mediaType);
  }

  if (malId == null) return [];
  return fetchV4Recommendations(malId, mediaType);
}

async function finalizeRecommendedRow(
  candidates: DiscoveryItem[],
  items: MediaItem[],
  exclude: DiscoveryItem[],
  mediaType: 'anime' | 'comic',
  malGenreIds: number[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const filtered =
    mediaType === 'anime'
      ? candidates.filter((i) => i.type === 'anime')
      : candidates.filter((i) => i.type === 'comic');

  let row = takeUniqueItems(filtered, ROW_COUNT, taken, items);

  if (row.length < ROW_COUNT && malGenreIds.length > 0) {
    const genrePool =
      mediaType === 'anime'
        ? await jikanAnimeByGenres(malGenreIds, 25)
        : await jikanMangaByGenres(malGenreIds, 25);
    row = takeUniqueItems(
      dedupeDiscoveryItems([...row, ...genrePool]),
      ROW_COUNT,
      taken,
      items,
    );
  }

  if (row.length < ROW_COUNT) {
    const directPool =
      mediaType === 'comic'
        ? await jikanRecentManga(25)
        : await jikanTopAiringAnime(25);
    row = takeUniqueItems(
      dedupeDiscoveryItems([...row, ...directPool]),
      ROW_COUNT,
      taken,
      items,
    );
  }

  if (row.length < ROW_COUNT) {
    const fallbackMalId = await defaultRecommendationMalId(mediaType);
    if (fallbackMalId != null) {
      const fallbackRecs = await fetchV4Recommendations(fallbackMalId, mediaType);
      row = takeUniqueItems(
        dedupeDiscoveryItems([...row, ...fallbackRecs]),
        ROW_COUNT,
        taken,
        items,
      );
    }
  }

  return row.slice(0, ROW_COUNT);
}

export async function fetchPrimaryTrendingRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const [seasonPool, airingPool] = await Promise.all([
    jikanSeasonNow(20),
    jikanTopAiringAnime(20),
  ]);
  const pool = dedupeDiscoveryItems([...seasonPool, ...airingPool]);
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchTrendingMangaRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  let pool = await jikanMangaFromRecommendationSeeds(25);
  if (pool.length < ROW_COUNT) {
    pool = dedupeDiscoveryItems([...pool, ...(await jikanTopPublishingManga(25))]);
  }
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchRecommendedAnimeRow(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
  malGenreIds: number[] = [],
): Promise<DiscoveryItem[]> {
  const seedItem = pickSeedItemForMediaType(items, 'anime');
  const candidates = await fetchRecommendationsForSeed(seedItem, lookupCache, 'anime');
  return finalizeRecommendedRow(candidates, items, exclude, 'anime', malGenreIds);
}

export async function fetchRecommendedMangaRow(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
  malGenreIds: number[] = [],
): Promise<DiscoveryItem[]> {
  const seedItem = pickSeedItemForMediaType(items, 'comic');
  const candidates = await fetchRecommendationsForSeed(seedItem, lookupCache, 'comic');
  return finalizeRecommendedRow(candidates, items, exclude, 'comic', malGenreIds);
}

export async function fetchRecommendedPrimary(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
  preferredGenres: string[] = [],
): Promise<{ primary: DiscoveryItem[]; seed: DiscoverySeed | null; personalized: boolean }> {
  const personalized = isPersonalizedRecommendations(items, preferredGenres);
  const genreNames = resolveRecommendationGenres(items, preferredGenres);
  const malIds = memoraGenresToMal(genreNames);

  const animeSeed = pickSeedItemForMediaType(items, 'anime') ?? pickSeedItem(items);
  let seed: DiscoverySeed | null = null;

  if (animeSeed) {
    const resolved = await resolveExternalId(animeSeed, lookupCache);
    seed = buildDiscoverySeed(animeSeed, resolved);
  }

  const primary = await fetchRecommendedAnimeRow(
    items,
    lookupCache,
    exclude,
    malIds,
  );

  return { primary, seed, personalized };
}

export async function fetchTrendingSection(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoverySectionRows> {
  // Fetch manga first while API rate limit is fresh (list endpoints often 504).
  const manga = await fetchTrendingMangaRow(items, exclude);
  const primary = await fetchPrimaryTrendingRow(items, [...exclude, ...manga]);
  return { primary, manga };
}

export async function fetchRecommendedSection(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
  preferredGenres: string[] = [],
): Promise<DiscoverySectionRows & { seed: DiscoverySeed | null; personalized: boolean }> {
  const genreNames = resolveRecommendationGenres(items, preferredGenres);
  const malIds = memoraGenresToMal(genreNames);
  const personalized = isPersonalizedRecommendations(items, preferredGenres);

  const { primary, seed } = await fetchRecommendedPrimary(
    items,
    lookupCache,
    exclude,
    preferredGenres,
  );
  const manga = await fetchRecommendedMangaRow(
    items,
    lookupCache,
    [...exclude, ...primary],
    malIds,
  );

  return { primary, manga, seed, personalized };
}
