import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed } from '../types/discovery';
import {
  excludeByTitle,
  fetchRecommendedSection,
  fetchTrendingSection,
} from '../data/recommendationEngine';
import { readFeedCache, writeFeedCache } from '../data/discoveryCache';
import { formatPrintSectionLabel, resolvePreferredPrintTypes } from '../data/printMediaTypes';

interface UseDiscoveryFeedResult {
  recommended: DiscoveryItem[];
  recommendedManga: DiscoveryItem[];
  trending: DiscoveryItem[];
  trendingManga: DiscoveryItem[];
  seed: DiscoverySeed | null;
  personalized: boolean;
  printLabel: string;
  recommendedLoading: boolean;
  trendingLoading: boolean;
  refreshRecommended: () => void;
}

const FEED_SESSION_VERSION = 'v9';
const TRENDING_CACHE_KEY = `recent-airing-${FEED_SESSION_VERSION}`;
const TRENDING_MANGA_CACHE_KEY = `recent-manga-${FEED_SESSION_VERSION}`;
const RECOMMENDED_CACHE_KEY = `session-${FEED_SESSION_VERSION}`;
const PRINT_LABEL_CACHE_KEY = `print-label-${FEED_SESSION_VERSION}`;

/** Survives tab remounts within the same page session. */
const sessionFeed = new Map<
  string,
  {
    recommended: DiscoveryItem[];
    recommendedManga: DiscoveryItem[];
    trending: DiscoveryItem[];
    trendingManga: DiscoveryItem[];
    seed: DiscoverySeed | null;
    personalized: boolean;
    printLabel: string;
    loaded: boolean;
  }
>();

function sessionKey(userId: string): string {
  return `${FEED_SESSION_VERSION}:${userId}`;
}

const emptySection = { primary: [] as DiscoveryItem[], manga: [] as DiscoveryItem[] };

export function useDiscoveryFeed(
  mediaItems: MediaItem[],
  userId: string | undefined,
  preferredGenres: string[] = [],
  customMediaTypes: string[] = [],
): UseDiscoveryFeedResult {
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;
  const preferredGenresRef = useRef(preferredGenres);
  preferredGenresRef.current = preferredGenres;
  const customMediaTypesRef = useRef(customMediaTypes);
  customMediaTypesRef.current = customMediaTypes;

  const session = userId ? sessionFeed.get(sessionKey(userId)) : undefined;
  const defaultPrintLabel = formatPrintSectionLabel(
    resolvePreferredPrintTypes(mediaItems, customMediaTypes),
  );

  const [recommended, setRecommended] = useState<DiscoveryItem[]>(
    () => session?.recommended ?? [],
  );
  const [recommendedManga, setRecommendedManga] = useState<DiscoveryItem[]>(
    () => session?.recommendedManga ?? [],
  );
  const [trending, setTrending] = useState<DiscoveryItem[]>(
    () => session?.trending ?? [],
  );
  const [trendingManga, setTrendingManga] = useState<DiscoveryItem[]>(
    () => session?.trendingManga ?? [],
  );
  const [seed, setSeed] = useState<DiscoverySeed | null>(() => session?.seed ?? null);
  const [personalized, setPersonalized] = useState(() => session?.personalized ?? false);
  const [printLabel, setPrintLabel] = useState(
    () => session?.printLabel ?? defaultPrintLabel,
  );
  const [recommendedLoading, setRecommendedLoading] = useState(() => !session?.loaded);
  const [trendingLoading, setTrendingLoading] = useState(() => !session?.loaded);
  const loadingRef = useRef(false);

  const persistSession = useCallback(
    (next: {
      recommended: DiscoveryItem[];
      recommendedManga: DiscoveryItem[];
      trending: DiscoveryItem[];
      trendingManga: DiscoveryItem[];
      seed: DiscoverySeed | null;
      personalized: boolean;
      printLabel: string;
    }) => {
      if (!userId) return;
      sessionFeed.set(sessionKey(userId), { ...next, loaded: true });
    },
    [userId],
  );

  const loadFeed = useCallback(
    async (force: boolean) => {
      if (!userId || loadingRef.current) return;

      const existing = sessionFeed.get(sessionKey(userId));
      if (
        !force &&
        existing?.loaded &&
        existing.recommendedManga.length > 0 &&
        existing.trendingManga.length > 0
      ) {
        setRecommended(existing.recommended);
        setRecommendedManga(existing.recommendedManga);
        setTrending(existing.trending);
        setTrendingManga(existing.trendingManga);
        setSeed(existing.seed);
        setPersonalized(existing.personalized);
        setPrintLabel(existing.printLabel);
        setRecommendedLoading(false);
        setTrendingLoading(false);
        return;
      }

      loadingRef.current = true;
      setRecommendedLoading(true);
      setTrendingLoading(true);

      const items = mediaItemsRef.current;
      const genres = preferredGenresRef.current;
      const mediaTypes = customMediaTypesRef.current;

      try {
        if (!force) {
          const cachedRec = readFeedCache<DiscoveryItem[]>(
            userId,
            'recommended',
            RECOMMENDED_CACHE_KEY,
          );
          const cachedRecManga = readFeedCache<DiscoveryItem[]>(
            userId,
            'recommended-manga',
            RECOMMENDED_CACHE_KEY,
          );
          const cachedTrend = readFeedCache<DiscoveryItem[]>(
            userId,
            'trending',
            TRENDING_CACHE_KEY,
          );
          const cachedTrendManga = readFeedCache<DiscoveryItem[]>(
            userId,
            'trending',
            TRENDING_MANGA_CACHE_KEY,
          );
          const cachedPersonalized = readFeedCache<boolean>(
            userId,
            'personalized',
            RECOMMENDED_CACHE_KEY,
          );
          const cachedPrintLabel = readFeedCache<string>(
            userId,
            'print-label',
            PRINT_LABEL_CACHE_KEY,
          );

          if (
            cachedRec &&
            cachedRecManga &&
            cachedTrend &&
            cachedTrendManga &&
            cachedRecManga.length > 0 &&
            cachedTrendManga.length > 0
          ) {
            const next = {
              recommended: cachedRec,
              recommendedManga: cachedRecManga,
              trending: excludeByTitle(cachedTrend, cachedRec),
              trendingManga: excludeByTitle(cachedTrendManga, [
                ...cachedRec,
                ...cachedRecManga,
              ]),
              seed: null as DiscoverySeed | null,
              personalized: cachedPersonalized ?? false,
              printLabel:
                cachedPrintLabel ??
                formatPrintSectionLabel(resolvePreferredPrintTypes(items, mediaTypes)),
            };
            setRecommended(next.recommended);
            setRecommendedManga(next.recommendedManga);
            setTrending(next.trending);
            setTrendingManga(next.trendingManga);
            setPersonalized(next.personalized);
            setPrintLabel(next.printLabel);
            persistSession(next);
            setRecommendedLoading(false);
            setTrendingLoading(false);
            loadingRef.current = false;
            return;
          }
        }

        const trendingResult = await fetchTrendingSection(items, [], mediaTypes);
        setTrending(trendingResult.primary);
        setTrendingManga(trendingResult.manga);
        setPrintLabel(trendingResult.printLabel);
        setTrendingLoading(false);
        writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, trendingResult.primary);
        writeFeedCache(
          userId,
          'trending',
          TRENDING_MANGA_CACHE_KEY,
          trendingResult.manga,
        );

        const lookupCache = new Map<string, number | null>();
        const recommendedResult = await fetchRecommendedSection(
          items,
          lookupCache,
          [...trendingResult.primary, ...trendingResult.manga],
          genres,
          mediaTypes,
        );

        const alignedTrending = excludeByTitle(
          trendingResult.primary,
          recommendedResult.primary,
        );
        const alignedTrendingManga = excludeByTitle(trendingResult.manga, [
          ...recommendedResult.primary,
          ...recommendedResult.manga,
        ]);

        const next = {
          recommended: recommendedResult.primary,
          recommendedManga: recommendedResult.manga,
          trending: alignedTrending,
          trendingManga: alignedTrendingManga,
          seed: recommendedResult.seed,
          personalized: recommendedResult.personalized,
          printLabel: recommendedResult.printLabel || trendingResult.printLabel,
        };

        setRecommended(next.recommended);
        setRecommendedManga(next.recommendedManga);
        setTrending(next.trending);
        setTrendingManga(next.trendingManga);
        setSeed(next.seed);
        setPersonalized(next.personalized);
        setPrintLabel(next.printLabel);
        writeFeedCache(userId, 'recommended', RECOMMENDED_CACHE_KEY, next.recommended);
        writeFeedCache(
          userId,
          'recommended-manga',
          RECOMMENDED_CACHE_KEY,
          next.recommendedManga,
        );
        writeFeedCache(
          userId,
          'personalized',
          RECOMMENDED_CACHE_KEY,
          next.personalized,
        );
        writeFeedCache(userId, 'print-label', PRINT_LABEL_CACHE_KEY, next.printLabel);
        persistSession(next);
      } catch {
        setRecommended(emptySection.primary);
        setRecommendedManga(emptySection.manga);
        setTrending(emptySection.primary);
        setTrendingManga(emptySection.manga);
        setPersonalized(false);
        persistSession({
          recommended: [],
          recommendedManga: [],
          trending: [],
          trendingManga: [],
          seed: null,
          personalized: false,
          printLabel: formatPrintSectionLabel(
            resolvePreferredPrintTypes(items, mediaTypes),
          ),
        });
      } finally {
        setRecommendedLoading(false);
        setTrendingLoading(false);
        loadingRef.current = false;
      }
    },
    [userId, persistSession],
  );

  useEffect(() => {
    if (!userId) {
      setRecommendedLoading(false);
      setTrendingLoading(false);
      return;
    }
    void loadFeed(false);
  }, [userId, loadFeed]);

  const refreshRecommended = useCallback(() => {
    if (!userId) return;
    sessionFeed.delete(sessionKey(userId));
    void loadFeed(true);
  }, [userId, loadFeed]);

  return {
    recommended,
    recommendedManga,
    trending,
    trendingManga,
    seed,
    personalized,
    printLabel,
    recommendedLoading,
    trendingLoading,
    refreshRecommended,
  };
}
