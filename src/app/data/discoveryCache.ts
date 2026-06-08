const FEED_TTL_MS = 24 * 60 * 60 * 1000;
const LOOKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

export function feedCacheKey(userId: string, section: string, cacheKey: string): string {
  return `memora:discovery:${userId}:${section}:${cacheKey}`;
}

export function readFeedCache<T>(userId: string, section: string, cacheKey: string): T | null {
  return readCache<T>(feedCacheKey(userId, section, cacheKey));
}

export function writeFeedCache<T>(
  userId: string,
  section: string,
  cacheKey: string,
  data: T,
): void {
  writeCache(feedCacheKey(userId, section, cacheKey), data, FEED_TTL_MS);
}

export function readLookupCache(key: string): number | null | undefined {
  const val = readCache<number | null>(`memora:lookup:${key}`);
  return val === null ? undefined : val;
}

export function writeLookupCache(key: string, id: number | null): void {
  writeCache(`memora:lookup:${key}`, id, LOOKUP_TTL_MS);
}
