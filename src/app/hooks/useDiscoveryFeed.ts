import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed } from '../types/discovery';
import {
  buildRecommendedCacheKey,
  computeTypeWeights,
  computeWeightedGenres,
  excludeByTitle,
  fetchRecommendedSection,
  fetchTrendingSection,
  pickSeedItem,
} from '../data/recommendationEngine';
import { readFeedCache, writeFeedCache } from '../data/discoveryCache';

interface UseDiscoveryFeedResult {
  recommended: DiscoveryItem[];
  recommendedManga: DiscoveryItem[];
  trending: DiscoveryItem[];
  trendingManga: DiscoveryItem[];
  seed: DiscoverySeed | null;
  personalized: boolean;
  recommendedLoading: boolean;
  trendingLoading: boolean;
  error: string | null;
  refreshRecommended: () => void;
}

const TRENDING_CACHE_KEY = 'global-v4';
const TRENDING_MANGA_CACHE_KEY = 'manga-v4';

export function useDiscoveryFeed(
  mediaItems: MediaItem[],
  userId: string | undefined,
): UseDiscoveryFeedResult {
  const [recommended, setRecommended] = useState<DiscoveryItem[]>([]);
  const [recommendedManga, setRecommendedManga] = useState<DiscoveryItem[]>([]);
  const [trending, setTrending] = useState<DiscoveryItem[]>([]);
  const [trendingManga, setTrendingManga] = useState<DiscoveryItem[]>([]);
  const [seed, setSeed] = useState<DiscoverySeed | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recommendedFetchedRef = useRef<string | null>(null);
  const trendingFetchedRef = useRef(false);
  const trendingExcludeRef = useRef<DiscoveryItem[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const trendingAlignedRef = useRef(false);

  useEffect(() => {
    trendingFetchedRef.current = false;
    trendingAlignedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setTrendingLoading(false);
      return;
    }

    if (trendingFetchedRef.current) return;

    const cached = readFeedCache<DiscoveryItem[]>(userId, 'trending', TRENDING_CACHE_KEY);
    const cachedManga = readFeedCache<DiscoveryItem[]>(
      userId,
      'trending',
      TRENDING_MANGA_CACHE_KEY,
    );

    if (cached && cachedManga) {
      setTrending(cached);
      setTrendingManga(cachedManga);
      trendingExcludeRef.current = [...cached, ...cachedManga];
      setTrendingLoading(false);
      trendingFetchedRef.current = true;
      return;
    }

    let cancelled = false;
    setTrendingLoading(true);

    fetchTrendingSection(mediaItems)
      .then((result) => {
        if (cancelled) return;
        setTrending(result.primary);
        setTrendingManga(result.manga);
        trendingExcludeRef.current = [...result.primary, ...result.manga];
        writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, result.primary);
        writeFeedCache(userId, 'trending', TRENDING_MANGA_CACHE_KEY, result.manga);
        trendingFetchedRef.current = true;
        setTrendingLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load trending');
        setTrendingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setRecommendedLoading(false);
      return;
    }

    if (trendingLoading) return;

    const seedItem = pickSeedItem(mediaItems);
    const weightedGenres = computeWeightedGenres(mediaItems);
    const typeWeights = computeTypeWeights(mediaItems);
    const cacheKey = buildRecommendedCacheKey(
      mediaItems,
      seedItem
        ? {
            mediaId: seedItem.id,
            title: seedItem.title,
            type: seedItem.type,
            externalId: null,
            source: null,
          }
        : null,
      weightedGenres.map((g) => g.name),
      typeWeights,
    );

    const fetchKey = `${userId}:${cacheKey}:${refreshToken}`;
    if (recommendedFetchedRef.current === fetchKey) return;

    const useCache = refreshToken === 0;
    const cachedRecommended = useCache
      ? readFeedCache<DiscoveryItem[]>(userId, 'recommended', cacheKey)
      : null;
    const cachedManga = useCache
      ? readFeedCache<DiscoveryItem[]>(userId, 'recommended-manga', cacheKey)
      : null;
    const cachedPersonalized = useCache
      ? readFeedCache<boolean>(userId, 'personalized', cacheKey)
      : null;

    if (cachedRecommended && cachedManga) {
      setRecommended(cachedRecommended);
      setRecommendedManga(cachedManga);
      setPersonalized(cachedPersonalized ?? false);
      setRecommendedLoading(false);
      setError(null);
      recommendedFetchedRef.current = fetchKey;
      return;
    }

    let cancelled = false;
    setRecommendedLoading(true);
    setError(null);

    const lookupCache = new Map<string, number | null>();
    fetchRecommendedSection(mediaItems, lookupCache, trendingExcludeRef.current)
      .then((result) => {
        if (cancelled) return;
        setRecommended(result.primary);
        setRecommendedManga(result.manga);
        setSeed(result.seed);
        setPersonalized(result.personalized);
        writeFeedCache(userId, 'recommended', cacheKey, result.primary);
        writeFeedCache(userId, 'recommended-manga', cacheKey, result.manga);
        writeFeedCache(userId, 'personalized', cacheKey, result.personalized);
        recommendedFetchedRef.current = fetchKey;
        setRecommendedLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        setRecommendedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaItems, userId, refreshToken, trendingLoading]);

  useEffect(() => {
    if (!userId || trendingLoading || recommendedLoading || trendingAlignedRef.current) return;

    const allRecommended = [...recommended, ...recommendedManga];
    const allTrending = [...trending, ...trendingManga];
    if (allRecommended.length === 0 || allTrending.length === 0) return;

    const overlap =
      excludeByTitle(allTrending, allRecommended).length < allTrending.length;

    if (!overlap) {
      trendingAlignedRef.current = true;
      return;
    }

    let cancelled = false;
    fetchTrendingSection(mediaItems, allRecommended).then((aligned) => {
      if (cancelled) return;
      setTrending(aligned.primary);
      setTrendingManga(aligned.manga);
      trendingExcludeRef.current = [...aligned.primary, ...aligned.manga];
      writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, aligned.primary);
      writeFeedCache(userId, 'trending', TRENDING_MANGA_CACHE_KEY, aligned.manga);
      trendingAlignedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    mediaItems,
    recommended,
    recommendedManga,
    trending,
    trendingManga,
    trendingLoading,
    recommendedLoading,
  ]);

  const refreshRecommended = () => {
    recommendedFetchedRef.current = null;
    trendingAlignedRef.current = false;
    setRefreshToken((t) => t + 1);
  };

  return {
    recommended,
    recommendedManga,
    trending,
    trendingManga,
    seed,
    personalized,
    recommendedLoading,
    trendingLoading,
    error,
    refreshRecommended,
  };
}
