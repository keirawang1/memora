import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed, DiscoverySectionRows } from '../types/discovery';
import { normalizeWatchStatus } from './analytics';
import { memoraGenresToMal } from './malGenres';
import { readLookupCache, writeLookupCache } from './discoveryCache';
import { getMangaFallbackPool } from './mangaFallback';
import {
  formatPrintSectionLabel,
  isPrintMediaType,
  preferredPrintTypesToJikan,
  resolvePreferredPrintTypes,
} from './printMediaTypes';
import {
  jikanRecommendations,
  jikanMangaRecommendations,
  jikanAnimeByGenres,
  jikanSearchAnime,
  jikanSearchManga,
  jikanSeasonNow,
  jikanTopAiringAnime,
  jikanTopPublishingManga,
  jikanTopManga,
  jikanMangaByGenres,
  jikanPopularPrintMix,
  DEFAULT_MANGA_REC_SEED_ID,
  DEFAULT_ANIME_REC_SEED_ID,
  parseMalAnimeIdFromLink,
  parseMalMangaIdFromLink,
} from '../services/jikan';
import { tmdbTrendingMovies, tmdbTrendingTv } from '../services/tmdb';

const ROW_COUNT = 5;
const TRENDING_COUNT = 4;

type CatalogMediaType = 'anime' | 'manga' | 'movie' | 'tv';

function mapLibraryType(type: string): CatalogMediaType | null {
  const t = type.trim().toLowerCase();
  if (t === 'anime') return 'anime';
  if (t === 'manga' || t === 'comic' || t === 'manhwa' || t === 'manhua' || t === 'light novel') {
    return 'manga';
  }
  if (t === 'movie') return 'movie';
  if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
  return null;
}

/** Allocate slots proportional to library mix, falling back to preferred media types. */
export function allocatePreferredTypeSlots(
  items: MediaItem[],
  total: number,
  preferredMediaTypes: string[] = [],
): CatalogMediaType[] {
  const counts = new Map<CatalogMediaType, number>();
  for (const item of items) {
    const t = mapLibraryType(item.type);
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) {
    for (const raw of preferredMediaTypes) {
      const t = mapLibraryType(raw);
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return (['anime', 'manga', 'movie', 'tv'] as CatalogMediaType[]).slice(0, total);
  }
  const sum = ranked.reduce((acc, [, c]) => acc + c, 0);
  const parts = ranked.map(([type, c]) => {
    const exact = (c / sum) * total;
    const floor = Math.floor(exact);
    return { type, floor, rem: exact - floor };
  });
  let remaining = total - parts.reduce((acc, p) => acc + p.floor, 0);
  for (const p of [...parts].sort((a, b) => b.rem - a.rem)) {
    if (remaining <= 0) break;
    p.floor += 1;
    remaining -= 1;
  }
  const slots: CatalogMediaType[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.floor; i++) slots.push(p.type);
  }
  return slots.slice(0, total);
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
  return isPrintMediaType(type);
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
    else if (isPrintMediaType(t)) weights.comic += 1;
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
): Promise<number> {
  return mediaType === 'anime' ? DEFAULT_ANIME_REC_SEED_ID : DEFAULT_MANGA_REC_SEED_ID;
}

async function fetchV4Recommendations(
  malId: number,
  mediaType: 'anime' | 'comic',
): Promise<DiscoveryItem[]> {
  return mediaType === 'comic'
    ? jikanMangaRecommendations(malId)
    : jikanRecommendations(malId);
}

/**
 * Resolve MAL id using local link/cache only — no Jikan search (saves rate limit).
 * Falls back to a stable seed id.
 */
async function resolveSeedMalId(
  seedItem: MediaItem | null,
  lookupCache: Map<string, number | null>,
  mediaType: 'anime' | 'comic',
): Promise<number> {
  if (seedItem) {
    if (mediaType === 'comic') {
      const fromLink = parseMalMangaIdFromLink(seedItem.link);
      if (fromLink) return fromLink;
    } else {
      const fromLink = parseMalAnimeIdFromLink(seedItem.link);
      if (fromLink) return fromLink;
    }

    const cacheKey = `${seedItem.type}:${normalizeTitle(seedItem.title)}`;
    const persisted = readLookupCache(cacheKey);
    if (persisted != null) {
      lookupCache.set(cacheKey, persisted);
      return persisted;
    }
    if (lookupCache.has(cacheKey)) {
      const cached = lookupCache.get(cacheKey);
      if (cached != null) return cached;
    }
  }

  return defaultRecommendationMalId(mediaType);
}

async function fetchRecommendationsForSeed(
  seedItem: MediaItem | null,
  lookupCache: Map<string, number | null>,
  mediaType: 'anime' | 'comic',
): Promise<DiscoveryItem[]> {
  const malId = await resolveSeedMalId(seedItem, lookupCache, mediaType);
  return fetchV4Recommendations(malId, mediaType);
}

/** At most one extra API call to fill a short row. */
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
      : candidates.filter((i) => isPrintMediaType(i.type));

  let row = takeUniqueItems(filtered, ROW_COUNT, taken, items);
  if (row.length >= ROW_COUNT) return row.slice(0, ROW_COUNT);

  const filler =
    mediaType === 'anime'
      ? malGenreIds.length > 0
        ? await jikanAnimeByGenres(malGenreIds, 15)
        : await jikanTopAiringAnime(15)
      : malGenreIds.length > 0
        ? await jikanMangaByGenres(malGenreIds, 15)
        : await jikanTopManga(15);

  row = takeUniqueItems(
    dedupeDiscoveryItems([...row, ...filler]),
    ROW_COUNT,
    taken,
    items,
  );

  return row.slice(0, ROW_COUNT);
}

export async function fetchPrimaryTrendingRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const seasonPool = await jikanSeasonNow(20);
  const pool =
    seasonPool.length >= ROW_COUNT
      ? seasonPool
      : dedupeDiscoveryItems([...seasonPool, ...(await jikanTopAiringAnime(20))]);
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchTrendingMangaRow(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
  preferredPrintTypes: string[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const printTypes =
    preferredPrintTypes.length > 0
      ? preferredPrintTypes
      : resolvePreferredPrintTypes(items);
  const jikanTypes = preferredPrintTypesToJikan(printTypes);

  let pool = await jikanPopularPrintMix(jikanTypes, 25);
  if (pool.length < ROW_COUNT) {
    pool = dedupeDiscoveryItems([...pool, ...(await jikanTopPublishingManga(25))]);
  }
  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
}

export async function fetchTrendingSection(
  items: MediaItem[],
  exclude: DiscoveryItem[] = [],
  customMediaTypes: string[] = [],
  preferredMediaTypes: string[] = [],
): Promise<{ items: DiscoveryItem[]; printLabel: string }> {
  const printTypes = resolvePreferredPrintTypes(items, customMediaTypes);
  const slots = allocatePreferredTypeSlots(items, TRENDING_COUNT, preferredMediaTypes);
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const jikanTypes = preferredPrintTypesToJikan(printTypes);

  const [animePool, mangaPool, moviePool, tvPool] = await Promise.all([
    jikanSeasonNow(20)
      .then(async (season) =>
        season.length >= TRENDING_COUNT
          ? season
          : dedupeDiscoveryItems([...season, ...(await jikanTopAiringAnime(20))]),
      )
      .catch(() => [] as DiscoveryItem[]),
    jikanPopularPrintMix(jikanTypes, 25)
      .then(async (mix) =>
        mix.length >= TRENDING_COUNT
          ? mix
          : dedupeDiscoveryItems([...mix, ...(await jikanTopPublishingManga(25))]),
      )
      .catch(() => [] as DiscoveryItem[]),
    tmdbTrendingMovies(20).catch(() => [] as DiscoveryItem[]),
    tmdbTrendingTv(20).catch(() => [] as DiscoveryItem[]),
  ]);

  const byType: Record<CatalogMediaType, DiscoveryItem[]> = {
    anime: animePool,
    manga: mangaPool,
    movie: moviePool,
    tv: tvPool,
  };

  const selected: DiscoveryItem[] = [];
  const used = new Set<string>();

  for (const t of slots) {
    const next = byType[t].find((c) => {
      const key = normalizeTitle(c.title);
      return !used.has(key) && !taken.has(key);
    });
    if (next) {
      used.add(normalizeTitle(next.title));
      selected.push(next);
    }
  }

  if (selected.length < TRENDING_COUNT) {
    const filler = dedupeDiscoveryItems([
      ...animePool,
      ...mangaPool,
      ...moviePool,
      ...tvPool,
    ]);
    for (const item of filler) {
      if (selected.length >= TRENDING_COUNT) break;
      const key = normalizeTitle(item.title);
      if (used.has(key) || taken.has(key)) continue;
      if (items.some((m) => normalizeTitle(m.title) === key)) continue;
      used.add(key);
      selected.push(item);
    }
  }

  return {
    items: selected.slice(0, TRENDING_COUNT),
    printLabel: formatPrintSectionLabel(printTypes),
  };
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
  preferredPrintTypes: string[] = [],
): Promise<DiscoveryItem[]> {
  const taken = new Set(exclude.map((i) => normalizeTitle(i.title)));
  const printTypes =
    preferredPrintTypes.length > 0
      ? preferredPrintTypes
      : resolvePreferredPrintTypes(items);
  const jikanTypes = preferredPrintTypesToJikan(printTypes);

  let pool = await jikanPopularPrintMix(jikanTypes, 25);

  if (pool.length < ROW_COUNT && malGenreIds.length > 0) {
    pool = dedupeDiscoveryItems([
      ...pool,
      ...(await jikanMangaByGenres(malGenreIds, 25)),
    ]);
  }

  if (pool.length < ROW_COUNT) {
    pool = dedupeDiscoveryItems([...pool, ...(await jikanTopPublishingManga(25))]);
  }

  if (pool.length < ROW_COUNT) {
    const seedItem = pickSeedItemForMediaType(items, 'comic');
    const seedRecs = await fetchRecommendationsForSeed(seedItem, lookupCache, 'comic');
    pool = dedupeDiscoveryItems([...pool, ...seedRecs]);
  }

  if (pool.length < ROW_COUNT) {
    pool = dedupeDiscoveryItems([
      ...pool,
      ...getMangaFallbackPool(25, printTypes),
    ]);
  }

  return takeUniqueItems(pool, ROW_COUNT, taken, items).slice(0, ROW_COUNT);
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
    const malId = await resolveSeedMalId(
      animeSeed,
      lookupCache,
      isComicType(animeSeed.type) ? 'comic' : 'anime',
    );
    seed = buildDiscoverySeed(animeSeed, {
      externalId: malId,
      mediaType: isComicType(animeSeed.type) ? 'comic' : 'anime',
    });
  }

  const primary = await fetchRecommendedAnimeRow(
    items,
    lookupCache,
    exclude,
    malIds,
  );

  return { primary, seed, personalized };
}

export async function fetchRecommendedSection(
  items: MediaItem[],
  lookupCache: Map<string, number | null>,
  exclude: DiscoveryItem[] = [],
  preferredGenres: string[] = [],
  customMediaTypes: string[] = [],
): Promise<
  DiscoverySectionRows & {
    seed: DiscoverySeed | null;
    personalized: boolean;
    printLabel: string;
  }
> {
  const genreNames = resolveRecommendationGenres(items, preferredGenres);
  const malIds = memoraGenresToMal(genreNames);
  const personalized = isPersonalizedRecommendations(items, preferredGenres);
  const printTypes = resolvePreferredPrintTypes(items, customMediaTypes);

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
    printTypes,
  );

  return {
    primary,
    manga,
    seed,
    personalized,
    printLabel: formatPrintSectionLabel(printTypes),
  };
}

/** Popular live picks for cold-start / small libraries. */
export async function fetchColdStartRecommendations(
  preferredGenres: string[] = [],
  preferredMediaTypes: string[] = [],
  libraryItems: MediaItem[] = [],
): Promise<DiscoveryItem[]> {
  const slots = allocatePreferredTypeSlots(libraryItems, TRENDING_COUNT, preferredMediaTypes);
  const malIds = memoraGenresToMal(preferredGenres);
  const printTypes = resolvePreferredPrintTypes(libraryItems, []);
  const jikanTypes = preferredPrintTypesToJikan(printTypes);

  const [animePool, mangaPool, moviePool, tvPool] = await Promise.all([
    (malIds.length > 0
      ? jikanAnimeByGenres(malIds, 20).then(async (rows) =>
          rows.length >= TRENDING_COUNT ? rows : dedupeDiscoveryItems([...rows, ...(await jikanTopAnime(20))]),
        )
      : jikanTopAnime(20)
    ).catch(() => [] as DiscoveryItem[]),
    (malIds.length > 0
      ? jikanMangaByGenres(malIds, 20).then(async (rows) =>
          rows.length >= TRENDING_COUNT
            ? rows
            : dedupeDiscoveryItems([...rows, ...(await jikanPopularPrintMix(jikanTypes, 20))]),
        )
      : jikanPopularPrintMix(jikanTypes, 20)
    ).catch(() => [] as DiscoveryItem[]),
    tmdbTrendingMovies(20).catch(() => [] as DiscoveryItem[]),
    tmdbTrendingTv(20).catch(() => [] as DiscoveryItem[]),
  ]);

  const byType: Record<CatalogMediaType, DiscoveryItem[]> = {
    anime: shuffleInPlace([...animePool]),
    manga: shuffleInPlace([...mangaPool]),
    movie: shuffleInPlace([...moviePool]),
    tv: shuffleInPlace([...tvPool]),
  };

  const taken = new Set(libraryItems.map((m) => normalizeTitle(m.title)));
  const selected: DiscoveryItem[] = [];
  const used = new Set<string>();
  const genreHint = preferredGenres[0];

  for (const t of slots) {
    const next = byType[t].find((c) => {
      const key = normalizeTitle(c.title);
      return !used.has(key) && !taken.has(key);
    });
    if (next) {
      used.add(normalizeTitle(next.title));
      selected.push({
        ...next,
        reason: genreHint
          ? `Popular pick for fans of ${genreHint}`
          : 'A popular pick for your taste profile',
      });
    }
  }

  if (selected.length < TRENDING_COUNT) {
    const filler = shuffleInPlace(
      dedupeDiscoveryItems([...animePool, ...mangaPool, ...moviePool, ...tvPool]),
    );
    for (const item of filler) {
      if (selected.length >= TRENDING_COUNT) break;
      const key = normalizeTitle(item.title);
      if (used.has(key) || taken.has(key)) continue;
      used.add(key);
      selected.push({
        ...item,
        reason: genreHint
          ? `Popular pick for fans of ${genreHint}`
          : 'A popular pick for your taste profile',
      });
    }
  }

  return selected.slice(0, TRENDING_COUNT);
}
