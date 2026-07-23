import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed } from '../types/discovery';
import {
  excludeByTitle,
  fetchColdStartRecommendations,
  fetchTrendingSection,
  isPersonalizedRecommendations,
} from '../data/recommendationEngine';
import { readFeedCache, writeFeedCache } from '../data/discoveryCache';
import { fetchPopularFromCatalog, fetchTrendingFromCatalog } from '../supabase/catalog';
import {
  cachedRecToDiscoveryItem,
  fetchUserRecommendations,
  refreshRecommendations,
} from '../supabase/recommendations';

interface UseDiscoveryFeedResult {
  recommended: DiscoveryItem[];
  trending: DiscoveryItem[];
  seed: DiscoverySeed | null;
  personalized: boolean;
  recommendedLoading: boolean;
  trendingLoading: boolean;
  refreshRecommended: () => void;
}

const FEED_SESSION_VERSION = 'v16';
const TRENDING_CACHE_KEY = `trending-live-${FEED_SESSION_VERSION}`;
const HIGH_RATING = 4;

const sessionFeed = new Map<
  string,
  {
    recommended: DiscoveryItem[];
    trending: DiscoveryItem[];
    seed: DiscoverySeed | null;
    personalized: boolean;
    loaded: boolean;
  }
>();

function sessionKey(userId: string): string {
  return `${FEED_SESSION_VERSION}:${userId}`;
}

function normalizeTitleLocal(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function useDiscoveryFeed(
  mediaItems: MediaItem[],
  userId: string | undefined,
  preferredGenres: string[] = [],
  customMediaTypes: string[] = [],
  preferredMediaTypes: string[] = [],
): UseDiscoveryFeedResult {
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;
  const preferredGenresRef = useRef(preferredGenres);
  preferredGenresRef.current = preferredGenres;
  const customMediaTypesRef = useRef(customMediaTypes);
  customMediaTypesRef.current = customMediaTypes;
  const preferredMediaTypesRef = useRef(preferredMediaTypes);
  preferredMediaTypesRef.current = preferredMediaTypes;

  const session = userId ? sessionFeed.get(sessionKey(userId)) : undefined;

  const [recommended, setRecommended] = useState<DiscoveryItem[]>(
    () => session?.recommended ?? [],
  );
  const [trending, setTrending] = useState<DiscoveryItem[]>(
    () => session?.trending ?? [],
  );
  const [seed, setSeed] = useState<DiscoverySeed | null>(() => session?.seed ?? null);
  const [personalized, setPersonalized] = useState(() => session?.personalized ?? false);
  const [recommendedLoading, setRecommendedLoading] = useState(
    () => !(session?.loaded && session.recommended.length >= 4),
  );
  const [trendingLoading, setTrendingLoading] = useState(
    () => !(session?.loaded && session.trending.length > 0),
  );
  const loadingRef = useRef(false);
  const recLoadingRef = useRef(false);

  const persistSession = useCallback(
    (patch: Partial<{
      recommended: DiscoveryItem[];
      trending: DiscoveryItem[];
      seed: DiscoverySeed | null;
      personalized: boolean;
    }>) => {
      if (!userId) return;
      const prev = sessionFeed.get(sessionKey(userId));
      const next = {
        recommended: patch.recommended ?? prev?.recommended ?? [],
        trending: patch.trending ?? prev?.trending ?? [],
        seed: patch.seed !== undefined ? patch.seed : (prev?.seed ?? null),
        personalized: patch.personalized ?? prev?.personalized ?? false,
        loaded: true,
      };
      sessionFeed.set(sessionKey(userId), next);
    },
    [userId],
  );

  const loadForYou = useCallback(
    async (force: boolean) => {
      if (!userId) return { items: [] as DiscoveryItem[], personalized: false };

      const items = mediaItemsRef.current;
      const genres = preferredGenresRef.current;
      const mediaTypes = preferredMediaTypesRef.current;
      const isPersonalized = isPersonalizedRecommendations(items, genres);
      const highRated = items.filter((m) => (m.rating ?? 0) > HIGH_RATING);
      const smallLibrary = highRated.length === 0;
      const exclude = items.map((m) => normalizeTitleLocal(m.title));
      const isDemo = userId.startsWith('demo');

      const coldStart = async () => {
        try {
          const cold = await fetchColdStartRecommendations(genres, mediaTypes, items);
          if (cold.length >= 4) return cold;
          if (cold.length > 0) {
            const extra = await fetchPopularFromCatalog(mediaTypes, genres, [
              ...exclude,
              ...cold.map((c) => normalizeTitleLocal(c.title)),
            ], 4 - cold.length);
            return [...cold, ...extra].slice(0, 4);
          }
        } catch {
          // fall through
        }
        return fetchPopularFromCatalog(mediaTypes, genres, exclude, 4);
      };

      // Demo has no real user recs row — always use live cold-start / catalog APIs.
      if (isDemo || smallLibrary) {
        const itemsOut = await coldStart();
        return {
          items: itemsOut,
          personalized: genres.length > 0 || mediaTypes.length > 0 || itemsOut.length > 0,
        };
      }

      try {
        if (!force) {
          const row = await fetchUserRecommendations(userId);
          const fresh =
            row &&
            row.expires_at &&
            new Date(row.expires_at).getTime() > Date.now() &&
            Array.isArray(row.items) &&
            row.items.length >= 4;
          if (fresh) {
            return {
              items: row.items.map(cachedRecToDiscoveryItem),
              personalized: isPersonalized || row.items.length > 0,
            };
          }
        }

        const result = await refreshRecommendations(true);
        let mapped = (result.items ?? []).map(cachedRecToDiscoveryItem);
        if (mapped.length > 0 && mapped.length < 4) {
          const extra = await fetchPopularFromCatalog(
            mediaTypes,
            genres,
            [...exclude, ...mapped.map((m) => normalizeTitleLocal(m.title))],
            4 - mapped.length,
          );
          mapped = [...mapped, ...extra].slice(0, 4);
        }
        if (mapped.length > 0) {
          return {
            items: mapped,
            personalized: isPersonalized || mapped.length > 0,
          };
        }
        const cold = await coldStart();
        return {
          items: cold,
          personalized: isPersonalized || cold.length > 0,
        };
      } catch {
        if (!force) {
          const row = await fetchUserRecommendations(userId).catch(() => null);
          if (row?.items && row.items.length >= 4) {
            return {
              items: row.items.map(cachedRecToDiscoveryItem),
              personalized: true,
            };
          }
        }
        const cold = await coldStart();
        return {
          items: cold,
          personalized: isPersonalized || cold.length > 0,
        };
      }
    },
    [userId],
  );

  const loadTrending = useCallback(
    async (excludeRecs: DiscoveryItem[] = []) => {
      if (!userId) return [] as DiscoveryItem[];

      const cached = readFeedCache<DiscoveryItem[]>(userId, 'trending', TRENDING_CACHE_KEY);
      if (cached && cached.length > 0) {
        return excludeByTitle(cached, excludeRecs).slice(0, 4);
      }

      const library = mediaItemsRef.current;
      const excludeTitles = [
        ...library.map((m) => normalizeTitleLocal(m.title)),
        ...excludeRecs.map((r) => normalizeTitleLocal(r.title)),
      ];

      try {
        const result = await fetchTrendingSection(
          library,
          excludeRecs,
          customMediaTypesRef.current,
          preferredMediaTypesRef.current,
        );
        const live = excludeByTitle(result.items, excludeRecs).slice(0, 4);
        if (live.length >= 4) {
          writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, live);
          return live;
        }

        // Partial live — fill remaining with recent catalog (not For You genre pool)
        const fill = await fetchTrendingFromCatalog(
          preferredMediaTypesRef.current,
          [...excludeTitles, ...live.map((i) => normalizeTitleLocal(i.title))],
          4 - live.length,
        );
        const mixed = [...live, ...fill].slice(0, 4);
        if (mixed.length > 0) {
          writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, mixed);
        }
        return mixed;
      } catch {
        const fallback = await fetchTrendingFromCatalog(
          preferredMediaTypesRef.current,
          excludeTitles,
          4,
        );
        if (fallback.length > 0) {
          writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, fallback);
        }
        return fallback;
      }
    },
    [userId],
  );

  const loadFeed = useCallback(async () => {
    if (!userId || loadingRef.current) return;

    const existing = sessionFeed.get(sessionKey(userId));
    if (
      existing?.loaded &&
      existing.recommended.length >= 4 &&
      existing.trending.length > 0
    ) {
      setRecommended(existing.recommended);
      setTrending(existing.trending);
      setSeed(existing.seed);
      setPersonalized(existing.personalized);
      setRecommendedLoading(false);
      setTrendingLoading(false);
      return;
    }

    loadingRef.current = true;
    const needRecs = !(existing?.recommended && existing.recommended.length >= 4);
    const needTrend = !(existing?.trending && existing.trending.length > 0);
    if (needRecs) setRecommendedLoading(true);
    if (needTrend) setTrendingLoading(true);

    let recs: DiscoveryItem[] = existing?.recommended ?? [];

    try {
      if (needRecs) {
        const forYou = await loadForYou(false);
        recs = forYou.items.slice(0, 4);
        setRecommended(recs);
        setPersonalized(forYou.personalized);
        setSeed(null);
        persistSession({ recommended: recs, personalized: forYou.personalized, seed: null });
      }
    } catch {
      if (needRecs) setRecommended([]);
    } finally {
      if (needRecs) setRecommendedLoading(false);
    }

    try {
      if (needTrend) {
        const trendingItems = await loadTrending(recs);
        const aligned = trendingItems.slice(0, 4);
        setTrending(aligned);
        persistSession({ trending: aligned });
      }
    } catch {
      if (needTrend) setTrending([]);
    } finally {
      if (needTrend) setTrendingLoading(false);
      loadingRef.current = false;
    }
  }, [userId, persistSession, loadForYou, loadTrending]);

  useEffect(() => {
    if (!userId) {
      setRecommendedLoading(false);
      setTrendingLoading(false);
      return;
    }
    void loadFeed();
  }, [userId, loadFeed]);

  const refreshRecommended = useCallback(() => {
    if (!userId || recLoadingRef.current) return;
    recLoadingRef.current = true;
    setRecommendedLoading(true);

    void (async () => {
      try {
        const forYou = await loadForYou(true);
        const recs = forYou.items.slice(0, 4);
        setRecommended(recs);
        setPersonalized(forYou.personalized);
        // Re-align trending away from new recs without refetching live APIs if cached
        const existing = sessionFeed.get(sessionKey(userId));
        const aligned = excludeByTitle(existing?.trending ?? trending, recs).slice(0, 4);
        if (aligned.length > 0) setTrending(aligned);
        persistSession({
          recommended: recs,
          personalized: forYou.personalized,
          trending: aligned.length > 0 ? aligned : existing?.trending,
        });
      } finally {
        setRecommendedLoading(false);
        recLoadingRef.current = false;
      }
    })();
  }, [userId, loadForYou, persistSession, trending]);

  return {
    recommended,
    trending,
    seed,
    personalized,
    recommendedLoading,
    trendingLoading,
    refreshRecommended,
  };
}
