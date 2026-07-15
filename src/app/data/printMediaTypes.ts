import type { MediaItem } from '../types/media';
import { normalizeWatchStatus } from './analytics';

/** Jikan /manga and /top/manga `type` query values. */
export type JikanMangaType =
  | 'manga'
  | 'novel'
  | 'lightnovel'
  | 'oneshot'
  | 'doujin'
  | 'manhwa'
  | 'manhua';

const PRINT_ALIASES: Record<string, string> = {
  comic: 'comic',
  comics: 'comic',
  manga: 'manga',
  manhwa: 'manhwa',
  manhua: 'manhua',
  webtoon: 'manhwa',
  webtoons: 'manhwa',
  'light novel': 'light novel',
  lightnovel: 'light novel',
  'light novels': 'light novel',
  ln: 'light novel',
  novel: 'light novel',
  novels: 'light novel',
};

/** True for manga / manhwa / manhua / light novel / comic family. */
export function isPrintMediaType(type: string): boolean {
  const key = type.trim().toLowerCase();
  return key in PRINT_ALIASES || key === 'doujin' || key === 'oneshot';
}

export function normalizePrintMediaType(type: string): string {
  const key = type.trim().toLowerCase();
  return PRINT_ALIASES[key] ?? key;
}

export function memoraTypeToJikanMangaType(type: string): JikanMangaType | null {
  const normalized = normalizePrintMediaType(type);
  switch (normalized) {
    case 'manhwa':
      return 'manhwa';
    case 'manhua':
      return 'manhua';
    case 'light novel':
      return 'lightnovel';
    case 'manga':
    case 'comic':
      return 'manga';
    default:
      return null;
  }
}

export function jikanMangaTypeToMemora(type: string | undefined): string {
  const t = (type ?? 'manga').toLowerCase().replace(/[\s_-]+/g, '');
  if (t === 'manhwa') return 'manhwa';
  if (t === 'manhua') return 'manhua';
  if (t === 'lightnovel' || t === 'novel') return 'light novel';
  if (t === 'manga' || t === 'oneshot' || t === 'doujin') return 'manga';
  return 'comic';
}

export function formatPrintSectionLabel(preferredTypes: string[]): string {
  const labels = [...new Set(preferredTypes.map(normalizePrintMediaType))]
    .map((t) => {
      if (t === 'light novel') return 'Light Novel';
      if (t === 'comic') return 'Comic';
      return t.charAt(0).toUpperCase() + t.slice(1);
    })
    .slice(0, 3);

  if (labels.length === 0) return 'Manga';
  if (labels.length === 1) return labels[0] === 'Comic' ? 'Manga' : labels[0];
  return labels.join(' · ');
}

/**
 * Preferred print types from library activity + custom tag preferences.
 * Falls back to a broad default mix when the user has no print preferences yet.
 */
export function resolvePreferredPrintTypes(
  items: MediaItem[],
  customMediaTypes: string[] = [],
): string[] {
  const scores = new Map<string, number>();

  const bump = (raw: string, weight: number) => {
    if (!isPrintMediaType(raw)) return;
    const key = normalizePrintMediaType(raw);
    scores.set(key, (scores.get(key) ?? 0) + weight);
  };

  for (const item of items) {
    const status = normalizeWatchStatus(item.status);
    if (status === 'not-started' || status === 'dropped') continue;
    const weight = item.rating && item.rating > 0 ? item.rating : 3;
    bump(item.type, weight);
  }

  for (const t of customMediaTypes) {
    bump(t, 1.5);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  if (ranked.length > 0) return ranked;
  return ['manga', 'manhwa', 'manhua', 'light novel'];
}

export function preferredPrintTypesToJikan(
  preferredTypes: string[],
): JikanMangaType[] {
  const out: JikanMangaType[] = [];
  const seen = new Set<JikanMangaType>();
  for (const t of preferredTypes) {
    const jikan = memoraTypeToJikanMangaType(t);
    if (!jikan || seen.has(jikan)) continue;
    seen.add(jikan);
    out.push(jikan);
  }
  return out.length > 0 ? out : ['manga', 'manhwa', 'manhua', 'lightnovel'];
}
