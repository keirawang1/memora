import type { DiscoveryItem } from '../types/discovery';

/** Client-side TMDB helpers for live trending movie/TV. */

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action',
  10765: 'Sci-Fi',
};

function apiKey(): string | null {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

async function tmdbGet(path: string): Promise<Record<string, unknown> | null> {
  const key = apiKey();
  if (!key) return null;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${TMDB}${path}${sep}api_key=${key}`);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

function genresFromIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => GENRE_MAP[Number(id)] ?? String(id)).filter(Boolean);
}

function mapMovie(row: Record<string, unknown>): DiscoveryItem {
  const id = Number(row.id);
  return {
    id: `tmdb-movie-${id}`,
    externalId: id,
    source: 'tmdb',
    title: String(row.title ?? ''),
    imageUrl: row.poster_path ? `${IMG}${row.poster_path}` : '',
    type: 'movie',
    genres: genresFromIds(row.genre_ids),
    link: `https://www.themoviedb.org/movie/${id}`,
    formatLabel: 'MOVIE',
  };
}

function mapTv(row: Record<string, unknown>): DiscoveryItem {
  const id = Number(row.id);
  return {
    id: `tmdb-tv-${id}`,
    externalId: id,
    source: 'tmdb',
    title: String(row.name ?? row.title ?? ''),
    imageUrl: row.poster_path ? `${IMG}${row.poster_path}` : '',
    type: 'tv',
    genres: genresFromIds(row.genre_ids),
    link: `https://www.themoviedb.org/tv/${id}`,
    formatLabel: 'TV',
  };
}

export async function tmdbTrendingMovies(limit = 20): Promise<DiscoveryItem[]> {
  const data = await tmdbGet('/trending/movie/day');
  const results = Array.isArray(data?.results) ? (data.results as Record<string, unknown>[]) : [];
  return results.slice(0, limit).map(mapMovie);
}

export async function tmdbTrendingTv(limit = 20): Promise<DiscoveryItem[]> {
  const data = await tmdbGet('/trending/tv/day');
  const results = Array.isArray(data?.results) ? (data.results as Record<string, unknown>[]) : [];
  return results.slice(0, limit).map(mapTv);
}
