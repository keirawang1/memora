import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types/media';
import type { DiscoveryItem, DiscoverySeed } from '../types/discovery';
import {
  excludeByTitle,
  fetchColdStartRecommendations,
  fetchTrendingSection,
  isPersonalizedRecommendations,
} from '../data/recommendationEngine';
import { getMangaFallbackPool } from '../data/mangaFallback';
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

const FEED_SESSION_VERSION = 'v17';
const TRENDING_CACHE_KEY = `trending-live-${FEED_SESSION_VERSION}`;
const HIGH_RATING = 4;
const LIVE_FEED_TIMEOUT_MS = 2500;
const REFRESH_TIMEOUT_MS = 7000;
const RECS_MAX_WAIT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

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
  libraryReady = true,
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
  const loadingKeyRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
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

      const catalogTypes = mediaTypes.length > 0 ? mediaTypes : customMediaTypesRef.current;

      const coldStart = async () => {
        const catalog = await fetchPopularFromCatalog(catalogTypes, genres, exclude, 4);
        if (catalog.length >= 4) return catalog;
        const live = await withTimeout(
          fetchColdStartRecommendations(genres, mediaTypes, items),
          LIVE_FEED_TIMEOUT_MS,
          [] as DiscoveryItem[],
        );
        const merged = excludeByTitle([...live, ...catalog], []).slice(0, 4);
        if (merged.length >= 4) return merged;
        const extra = await fetchPopularFromCatalog(
          catalogTypes,
          genres,
          [...exclude, ...merged.map((c) => normalizeTitleLocal(c.title))],
          4 - merged.length,
        );
        return [...merged, ...extra].slice(0, 4);
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

        const result = await withTimeout(
          refreshRecommendations(true),
          REFRESH_TIMEOUT_MS,
          { items: [] as Awaited<ReturnType<typeof refreshRecommendations>>['items'], cached: false },
        );
        let mapped = (result.items ?? []).map(cachedRecToDiscoveryItem);
        if (mapped.length > 0 && mapped.length < 4) {
          const extra = await fetchPopularFromCatalog(
            catalogTypes,
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

  const fallbackRecs = useCallback(async (avoid: DiscoveryItem[] = []) => {
    const library = mediaItemsRef.current;
    const typeHint =
      preferredMediaTypesRef.current.length > 0
        ? preferredMediaTypesRef.current
        : customMediaTypesRef.current;
    const excludeTitles = [
      ...library.map((m) => normalizeTitleLocal(m.title)),
      ...avoid.map((a) => normalizeTitleLocal(a.title)),
    ];
    const fromCatalog = await withTimeout(
      fetchTrendingFromCatalog(typeHint, excludeTitles, 8)
        .then(async (rows) =>
          rows.length >= 4
            ? rows
            : [...rows, ...(await fetchPopularFromCatalog([], [], excludeTitles, 8))],
        )
        .catch(() => [] as DiscoveryItem[]),
      1500,
      [] as DiscoveryItem[],
    );
    const pool = excludeByTitle(
      [...fromCatalog, ...getMangaFallbackPool(12, customMediaTypesRef.current)],
      avoid,
    );
    const out = pool.slice(0, 4);
    return out.length > 0 ? out : getMangaFallbackPool(4, []).slice(0, 4);
  }, []);

  const loadTrending = useCallback(
    async (excludeRecs: DiscoveryItem[] = []) => {
      if (!userId) return [] as DiscoveryItem[];

      const cached = readFeedCache<DiscoveryItem[]>(userId, 'trending', TRENDING_CACHE_KEY);
      if (cached && cached.length > 0) {
        return excludeByTitle(cached, excludeRecs).slice(0, 4);
      }

      const library = mediaItemsRef.current;
      const typeHint =
        preferredMediaTypesRef.current.length > 0
          ? preferredMediaTypesRef.current
          : customMediaTypesRef.current;
      const excludeTitles = [
        ...library.map((m) => normalizeTitleLocal(m.title)),
        ...excludeRecs.map((r) => normalizeTitleLocal(r.title)),
      ];

      const catalog = await fetchTrendingFromCatalog(typeHint, excludeTitles, 4);
      const fromCatalog = excludeByTitle(catalog, excludeRecs).slice(0, 4);
      if (fromCatalog.length >= 4) {
        writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, fromCatalog);
        return fromCatalog;
      }

      const live = await withTimeout(
        fetchTrendingSection(
          library,
          excludeRecs,
          customMediaTypesRef.current,
          preferredMediaTypesRef.current,
        ).then((result) => excludeByTitle(result.items, excludeRecs).slice(0, 4)),
        LIVE_FEED_TIMEOUT_MS,
        [] as DiscoveryItem[],
      );

      const mixed = excludeByTitle([...live, ...fromCatalog], excludeRecs).slice(0, 4);
      if (mixed.length >= 4) {
        writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, mixed);
        return mixed;
      }

      const fallback = excludeByTitle(
        [...mixed, ...getMangaFallbackPool(8, customMediaTypesRef.current)],
        excludeRecs,
      ).slice(0, 4);
      if (fallback.length > 0) {
        writeFeedCache(userId, 'trending', TRENDING_CACHE_KEY, fallback);
      }
      return fallback;
    },
    [userId],
  );

  const loadFeed = useCallback(async () => {
    if (!userId) return;
    const key = sessionKey(userId);
    if (loadingKeyRef.current === key) return;
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;

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

    loadingKeyRef.current = key;
    const needRecs = !(existing?.recommended && existing.recommended.length >= 4);
    const needTrend = !(existing?.trending && existing.trending.length > 0);
    if (needRecs) setRecommendedLoading(true);
    if (needTrend) setTrendingLoading(true);

    const loadRecsWithRetry = async () => {
      const attempt = async () => {
        try {
          const first = await loadForYou(false);
          if (first.items.length > 0) return first;
        } catch (err) {
          console.warn('[discovery] recs first attempt failed', err);
        }
        await new Promise((r) => window.setTimeout(r, 800));
        try {
          const second = await loadForYou(false);
          if (second.items.length > 0) return second;
        } catch (err) {
          console.warn('[discovery] recs retry failed', err);
        }
        return null;
      };
      const result = await withTimeout(attempt(), RECS_MAX_WAIT_MS, null);
      if (result && result.items.length > 0) return result;
      return { items: await fallbackRecs(), personalized: false };
    };

    const recsTask = needRecs
      ? loadRecsWithRetry()
          .then((forYou) => {
            const recs = forYou.items.slice(0, 4);
            if (!isCurrent()) return recs;
            setRecommended(recs);
            setPersonalized(forYou.personalized);
            setSeed(null);
            if (recs.length > 0) {
              persistSession({ recommended: recs, personalized: forYou.personalized, seed: null });
            }
            return recs;
          })
          .catch((err) => {
            console.warn('[discovery] recs load failed', err);
            if (isCurrent()) setRecommended([]);
            return [] as DiscoveryItem[];
          })
          .finally(() => {
            if (isCurrent()) setRecommendedLoading(false);
          })
      : Promise.resolve(existing?.recommended ?? []);

    const trendTask = needTrend
      ? loadTrending(existing?.recommended ?? [])
          .then((trendingItems) => {
            const aligned = trendingItems.slice(0, 4);
            if (!isCurrent()) return aligned;
            setTrending(aligned);
            if (aligned.length > 0) persistSession({ trending: aligned });
            return aligned;
          })
          .catch((err) => {
            console.warn('[discovery] trending load failed', err);
            if (isCurrent()) setTrending([]);
            return [] as DiscoveryItem[];
          })
          .finally(() => {
            if (isCurrent()) setTrendingLoading(false);
          })
      : Promise.resolve(existing?.trending ?? []);

    await Promise.all([recsTask, trendTask]);
    if (loadingKeyRef.current === key) loadingKeyRef.current = null;
  }, [userId, persistSession, loadForYou, loadTrending, fallbackRecs]);

  useEffect(() => {
    if (!userId) {
      setRecommendedLoading(false);
      setTrendingLoading(false);
      return;
    }
    if (!libraryReady) {
      const cached = sessionFeed.get(sessionKey(userId));
      if (!(cached?.recommended.length)) setRecommendedLoading(true);
      if (!(cached?.trending.length)) setTrendingLoading(true);
      return;
    }
    void loadFeed();
  }, [userId, libraryReady, loadFeed]);

  const refreshRecommended = useCallback(() => {
    if (!userId || recLoadingRef.current) return;
    recLoadingRef.current = true;
    setRecommendedLoading(true);

    void (async () => {
      try {
        const loaded = await withTimeout(
          loadForYou(true).catch((err) => {
            console.warn('[discovery] recs refresh failed', err);
            return null;
          }),
          RECS_MAX_WAIT_MS,
          null,
        );
        const forYou =
          loaded && loaded.items.length > 0
            ? loaded
            : { items: await fallbackRecs(recommended), personalized: false };
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
  }, [userId, loadForYou, persistSession, trending, recommended, fallbackRecs]);

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
