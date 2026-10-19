import { supabase } from './client';
import type { DiscoveryItem } from '../types/discovery';

type CatalogRow = {
  id: string;
  source: string;
  external_id: string;
  media_type: string;
  title: string;
  genres: string[] | null;
  image_url: string | null;
  external_url: string | null;
  synopsis?: string | null;
};

const CATALOG_COLUMNS =
  'id, source, external_id, media_type, title, genres, image_url, external_url, synopsis';

function formatLabel(mediaType: string): string {
  switch (mediaType) {
    case 'anime':
      return 'ANIME';
    case 'manga':
      return 'MANGA';
    case 'movie':
      return 'MOVIE';
    case 'tv':
      return 'TV';
    default:
      return mediaType.toUpperCase();
  }
}

function mapPreferredToCatalogTypes(preferredMediaTypes: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of preferredMediaTypes) {
    const t = raw.trim().toLowerCase();
    let mapped: string | null = null;
    if (t === 'anime') mapped = 'anime';
    else if (
      t === 'manga' ||
      t === 'comic' ||
      t === 'manhwa' ||
      t === 'manhua' ||
      t === 'light novel' ||
      t === 'danmei' ||
      t === 'fanfic'
    ) {
      mapped = 'manga';
    } else if (t === 'movie') mapped = 'movie';
    else if (t === 'tv' || t === 'show' || t === 'series') mapped = 'tv';
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out.length > 0 ? out : ['anime', 'manga', 'movie', 'tv'];
}

function rowToDiscovery(row: CatalogRow, reason?: string): DiscoveryItem {
  const externalNumeric = Number(row.external_id);
  return {
    id: `catalog-${row.id}`,
    externalId: Number.isFinite(externalNumeric) ? externalNumeric : 0,
    source:
      row.source === 'tmdb' || row.source === 'movie_ratings' ? 'tmdb' : 'jikan',
    title: row.title,
    imageUrl: row.image_url ?? '',
    type: row.media_type,
    genres: row.genres ?? [],
    link: row.external_url ?? '',
    formatLabel: formatLabel(row.media_type),
    reason,
    catalogId: row.id,
    synopsis: row.synopsis?.trim() || undefined,
  };
}

/** Synopsis from media_catalog by id, then source/external id, then exact title. */
export async function fetchCatalogSynopsis(item: DiscoveryItem): Promise<string | null> {
  const pick = (data: unknown): string | null => {
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as {
      synopsis?: string | null;
    }[];
    const hit = rows.find((r) => r.synopsis?.trim());
    return hit?.synopsis?.trim() ?? null;
  };

  if (item.catalogId) {
    const { data } = await supabase
      .from('media_catalog')
      .select('synopsis')
      .eq('id', item.catalogId)
      .maybeSingle();
    const text = pick(data);
    if (text) return text;
  }

  if (item.externalId) {
    const sources =
      item.source === 'jikan' ? ['jikan'] : ['tmdb', 'movie_ratings'];
    const { data } = await supabase
      .from('media_catalog')
      .select('synopsis')
      .in('source', sources)
      .eq('external_id', String(item.externalId))
      .limit(3);
    const text = pick(data);
    if (text) return text;
  }

  const { data } = await supabase
    .from('media_catalog')
    .select('synopsis')
    .ilike('title', item.title.trim().replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(3);
  return pick(data);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Reliable popular picks from media_catalog (no Jikan/TMDB required).
 */
export async function fetchPopularFromCatalog(
  preferredMediaTypes: string[] = [],
  preferredGenres: string[] = [],
  excludeTitles: string[] = [],
  limit = 4,
): Promise<DiscoveryItem[]> {
  const types = mapPreferredToCatalogTypes(preferredMediaTypes);
  const exclude = new Set(excludeTitles.map((t) => t.trim().toLowerCase()));
  const reason = preferredGenres[0]
    ? `Popular pick for fans of ${preferredGenres[0]}`
    : 'A popular pick for your taste profile';

  let query = supabase
    .from('media_catalog')
    .select(CATALOG_COLUMNS)
    .in('media_type', types)
    .not('image_url', 'is', null)
    .limit(80);

  if (preferredGenres.length > 0) {
    query = query.overlaps('genres', preferredGenres);
  }

  const { data, error } = await query;
  let rows = ((data ?? []) as CatalogRow[]).filter(
    (r) => !exclude.has(r.title.trim().toLowerCase()),
  );

  if (error || rows.length < limit) {
    const { data: fallback } = await supabase
      .from('media_catalog')
      .select(CATALOG_COLUMNS)
      .in('media_type', types)
      .not('image_url', 'is', null)
      .limit(80);
    rows = ((fallback ?? []) as CatalogRow[]).filter(
      (r) => !exclude.has(r.title.trim().toLowerCase()),
    );
  }

  if (rows.length < limit) {
    const { data: anyRows } = await supabase
      .from('media_catalog')
      .select(CATALOG_COLUMNS)
      .not('image_url', 'is', null)
      .limit(80);
    rows = ((anyRows ?? []) as CatalogRow[]).filter(
      (r) => !exclude.has(r.title.trim().toLowerCase()),
    );
  }

  // Prefer one of each requested type when possible
  const byType = new Map<string, CatalogRow[]>();
  for (const row of shuffle(rows)) {
    const list = byType.get(row.media_type) ?? [];
    list.push(row);
    byType.set(row.media_type, list);
  }

  const selected: CatalogRow[] = [];
  const used = new Set<string>();
  for (const t of types) {
    if (selected.length >= limit) break;
    const next = (byType.get(t) ?? []).find((r) => !used.has(r.id));
    if (next) {
      used.add(next.id);
      selected.push(next);
    }
  }
  for (const row of rows) {
    if (selected.length >= limit) break;
    if (used.has(row.id)) continue;
    used.add(row.id);
    selected.push(row);
  }

  return selected.slice(0, limit).map((r) => rowToDiscovery(r, reason));
}

/**
 * Trending fill from catalog — no preferred-genre filter so it differs from For You.
 */
export async function fetchTrendingFromCatalog(
  preferredMediaTypes: string[] = [],
  excludeTitles: string[] = [],
  limit = 4,
): Promise<DiscoveryItem[]> {
  const types = mapPreferredToCatalogTypes(preferredMediaTypes);
  const exclude = new Set(excludeTitles.map((t) => t.trim().toLowerCase()));

  const { data } = await supabase
    .from('media_catalog')
    .select(CATALOG_COLUMNS)
    .in('media_type', types)
    .not('image_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(100);

  const rows = shuffle(
    ((data ?? []) as CatalogRow[]).filter((r) => !exclude.has(r.title.trim().toLowerCase())),
  );

  const byType = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const list = byType.get(row.media_type) ?? [];
    list.push(row);
    byType.set(row.media_type, list);
  }

  const selected: CatalogRow[] = [];
  const used = new Set<string>();
  for (const t of types) {
    if (selected.length >= limit) break;
    const next = (byType.get(t) ?? []).find((r) => !used.has(r.id));
    if (next) {
      used.add(next.id);
      selected.push(next);
    }
  }
  for (const row of rows) {
    if (selected.length >= limit) break;
    if (used.has(row.id)) continue;
    used.add(row.id);
    selected.push(row);
  }

  return selected.slice(0, limit).map((r) => rowToDiscovery(r));
}
