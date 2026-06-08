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
  jikanTopAnime,
  jikanTopManga,
  jikanMangaByGenres,
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

export function pickSeedItem(items: MediaItem[]): MediaItem | null {
  const completed = items.filter(
    (item) => normalizeWatchStatus(item.status) === 'completed',
  );
  if (completed.length === 0) return null;

  return completed.sort((a, b) => {
    const ratingA = a.rating && a.rating > 0 ? a.rating : 3;
    const ratingB = b.rating && b.rating > 0 ? b.rating : 3;
    if (ratingB !== ratingA) return ratingB - ratingA;
    const dateA = a.dateCompleted ?? a.dateAdded;
    const dateB = b.dateCompleted ?? b.dateAdded;
    return dateB.localeCompare(dateA);
  })[0];
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
): string {
  const personalized = hasEnoughPersonalizationData(items);
  const parts = [
    personalized ? 'personalized' : 'general',
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

export async function fetchMangaRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
  malGenreIds: number[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const pool =
    malGenreIds.length > 0
      ? await jikanMangaByGenres(malGenreIds, 25)
      : await jikanTopManga(25);
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchPrimaryTrendingRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const [seasonPool, topPool] = await Promise.all([
    jikanSeasonNow(20),
    jikanTopAnime(20),
  ]);
  const pool = dedupeDiscoveryItems([...seasonPool, ...topPool]);
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchPrimaryRecommendedRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const pool = await jikanTopAnime(25);
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

function pickAnimeFromCandidates(
  candidates: DiscoveryItem[],
  exclude: DiscoveryItem[],
  items: MediaItem[],
): DiscoveryItem[] {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const anime = candidates.filter((i) => i.type === 'anime');
  return takeUniqueItems(anime, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

async function finalizeRecommendedPrimary(
  candidates: DiscoveryItem[],
  items: MediaItem[],
  exclude: DiscoveryItem[],
): Promise<DiscoveryItem[]> {
  let primary = pickAnimeFromCandidates(candidates, exclude, items);

  if (primary.length < ROW_COUNT) {
    const backfill = await fetchPrimaryRecommendedRow(items, [
      ...exclude,
      ...candidates,
      ...primary,
    ]);
    primary = dedupeDiscoveryItems([...primary, ...backfill]).slice(0, ROW_COUNT);
    primary = excludeByTitle(primary, exclude);
  }

  return primary.slice(0, ROW_COUNT);
}

export async function fetchRecommendedPrimary(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
): Promise<{ primary: DiscoveryItem[]; seed: DiscoverySeed | null; personalized: boolean }> {
  if (!hasEnoughPersonalizationData(items)) {
    const primary = await fetchPrimaryRecommendedRow(items, exclude);
    return { primary, seed: null, personalized: false };
  }

  const seedItem = pickSeedItem(items);
  const weightedGenres = computeWeightedGenres(items);
  const topGenreNames = weightedGenres.slice(0, 5).map((g) => g.name);

  let candidates: DiscoveryItem[] = [];
  let seed: DiscoverySeed | null = null;

  if (seedItem) {
    const resolved = await resolveExternalId(seedItem, lookupCache);
    seed = buildDiscoverySeed(seedItem, resolved);

    if (resolved) {
      candidates =
        resolved.mediaType === 'comic'
          ? await jikanMangaRecommendations(resolved.externalId)
          : await jikanRecommendations(resolved.externalId);
    }
  }

  if (candidates.length < ROW_COUNT && topGenreNames.length > 0) {
    const malIds = memoraGenresToMal(topGenreNames);
    const jikanFallback = await jikanAnimeByGenres(malIds);
    candidates = dedupeDiscoveryItems([...candidates, ...jikanFallback]);
  }

  const primary = await finalizeRecommendedPrimary(candidates, items, exclude);
  return { primary, seed, personalized: true };
}

export async function fetchTrendingSection(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoverySectionRows> {
  const primary = await fetchPrimaryTrendingRow(items, exclude);
  const manga = await fetchMangaRow(items, [...exclude, ...primary]);
  return { primary, manga };
}

export async function fetchRecommendedSection(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
): Promise<DiscoverySectionRows & { seed: DiscoverySeed | null; personalized: boolean }> {
  const weightedGenres = computeWeightedGenres(items);
  const malIds = memoraGenresToMal(weightedGenres.slice(0, 5).map((g) => g.name));

  const { primary, seed, personalized } = await fetchRecommendedPrimary(
    items,
    lookupCache,
    exclude,
  );
  const manga = await fetchMangaRow(items, [...exclude, ...primary], malIds);

  return { primary, manga, seed, personalized };
}
