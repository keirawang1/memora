import type { MediaItem, WatchStatus } from '../types/media';

export function normalizeWatchStatus(status: string): WatchStatus {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  if (normalized === 'complete' || normalized === 'watched') return 'completed';
  if (normalized === 'want-to-watch' || normalized === 'wanttowatch' || normalized === 'plan-to-watch') {
    return 'not-started';
  }
  if (normalized === 'in-progress' || normalized === 'inprogress') {
    return 'in-progress';
  }
  if (['completed', 'not-started', 'in-progress', 'dropped'].includes(normalized)) {
    return normalized as WatchStatus;
  }
  return 'not-started';
}

export function parseGenresFromDb(genres: unknown): string[] {
  if (genres == null) return [];
  if (Array.isArray(genres)) {
    return genres.map((g) => String(g).trim()).filter(Boolean);
  }
  if (typeof genres === 'string') {
    const trimmed = genres.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((g) => String(g).trim()).filter(Boolean);
        }
      } catch {
        // fall through
      }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

/** Media included in library analytics (everything except not-started). */
export function analyticsMediaItems(items: MediaItem[]): MediaItem[] {
  return items.filter((item) => normalizeWatchStatus(item.status) !== 'not-started');
}

export function computeMediaTypeCounts(items: MediaItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of analyticsMediaItems(items)) {
    const type = item.type.trim().toLowerCase();
    if (!type) continue;
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

export function computeGenreCounts(items: MediaItem[]): { name: string; value: number }[] {
  const byKey = new Map<string, { name: string; value: number }>();

  for (const item of analyticsMediaItems(items)) {
    for (const raw of item.genre) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.value += 1;
      } else {
        byKey.set(key, { name, value: 1 });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.value - a.value);
}
