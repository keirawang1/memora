import type { DiscoveryItem } from '../types/discovery';
import { malGenresToMemora } from '../data/malGenres';

const BASE = 'https://api.jikan.moe/v4';

let lastRequestAt = 0;
const MIN_GAP_MS = 350;

async function jikanFetch<T>(path: string): Promise<T> {
  const now = Date.now();
  const wait = MIN_GAP_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Jikan ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

interface JikanAnime {
  mal_id: number;
  title: string;
  type?: string;
  images?: {
    jpg?: { large_image_url?: string; image_url?: string };
  };
  genres?: { mal_id: number; name: string }[];
}

interface JikanListResponse {
  data: JikanAnime[];
}

interface JikanRecEntry {
  entry: JikanAnime;
}

interface JikanRecResponse {
  data: JikanRecEntry[];
}

function mapJikanAnime(anime: JikanAnime): DiscoveryItem {
  const genreIds = (anime.genres ?? []).map((g) => g.mal_id);
  const formatLabel = (anime.type ?? 'ANIME').toUpperCase();
  return {
    id: `mal-${anime.mal_id}`,
    externalId: anime.mal_id,
    source: 'jikan',
    title: anime.title,
    imageUrl:
      anime.images?.jpg?.large_image_url ??
      anime.images?.jpg?.image_url ??
      '',
    type: 'anime',
    genres: malGenresToMemora(genreIds),
    link: `https://myanimelist.net/anime/${anime.mal_id}`,
    formatLabel,
  };
}

export async function jikanSeasonNow(limit = 15): Promise<DiscoveryItem[]> {
  const json = await jikanFetch<JikanListResponse>('/seasons/now');
  return json.data.slice(0, limit).map(mapJikanAnime);
}

export async function jikanTopAnime(limit = 12): Promise<DiscoveryItem[]> {
  const json = await jikanFetch<JikanListResponse>(
    `/top/anime?filter=bypopularity&limit=${limit}`,
  );
  return json.data.map(mapJikanAnime);
}

export async function jikanRecommendations(malId: number): Promise<DiscoveryItem[]> {
  const json = await jikanFetch<JikanRecResponse>(`/anime/${malId}/recommendations`);
  return json.data.map((e) => mapJikanAnime(e.entry));
}

export async function jikanSearchAnime(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  const json = await jikanFetch<JikanListResponse>(`/anime?q=${q}&limit=1`);
  const first = json.data[0];
  return first ? mapJikanAnime(first) : null;
}

export async function jikanAnimeByGenres(
  genreIds: number[],
  limit = 25,
): Promise<DiscoveryItem[]> {
  if (genreIds.length === 0) return [];
  const ids = genreIds.slice(0, 3).join(',');
  const json = await jikanFetch<JikanListResponse>(
    `/anime?genres=${ids}&order_by=popularity&sort=desc&limit=${limit}`,
  );
  return json.data.map(mapJikanAnime);
}

function mapJikanManga(manga: JikanAnime): DiscoveryItem {
  const genreIds = (manga.genres ?? []).map((g) => g.mal_id);
  const formatLabel = (manga.type ?? 'MANGA').toUpperCase();
  return {
    id: `mal-manga-${manga.mal_id}`,
    externalId: manga.mal_id,
    source: 'jikan',
    title: manga.title,
    imageUrl:
      manga.images?.jpg?.large_image_url ??
      manga.images?.jpg?.image_url ??
      '',
    type: 'comic',
    genres: malGenresToMemora(genreIds),
    link: `https://myanimelist.net/manga/${manga.mal_id}`,
    formatLabel: formatLabel === 'MANGA' ? 'MANGA' : formatLabel,
  };
}

export async function jikanTopManga(limit = 15): Promise<DiscoveryItem[]> {
  const json = await jikanFetch<JikanListResponse>(
    `/top/manga?filter=bypopularity&limit=${limit}`,
  );
  return json.data.map(mapJikanManga);
}

export async function jikanMangaByGenres(
  genreIds: number[],
  limit = 25,
): Promise<DiscoveryItem[]> {
  if (genreIds.length === 0) return [];
  const ids = genreIds.slice(0, 3).join(',');
  const json = await jikanFetch<JikanListResponse>(
    `/manga?genres=${ids}&order_by=popularity&sort=desc&limit=${limit}`,
  );
  return json.data.map(mapJikanManga);
}

export async function jikanMangaRecommendations(malId: number): Promise<DiscoveryItem[]> {
  const json = await jikanFetch<JikanRecResponse>(`/manga/${malId}/recommendations`);
  return json.data.map((e) => mapJikanManga(e.entry));
}

export async function jikanSearchManga(title: string): Promise<DiscoveryItem | null> {
  const q = encodeURIComponent(title.trim());
  if (!q) return null;
  const json = await jikanFetch<JikanListResponse>(`/manga?q=${q}&limit=1`);
  const first = json.data[0];
  return first ? mapJikanManga(first) : null;
}

interface JikanDetailData {
  synopsis?: string;
  background?: string;
}

interface JikanDetailResponse {
  data: JikanDetailData;
}

export async function jikanFetchSynopsis(item: DiscoveryItem): Promise<string> {
  const path =
    item.type === 'comic' ? `/manga/${item.externalId}` : `/anime/${item.externalId}`;
  try {
    const json = await jikanFetch<JikanDetailResponse>(path);
    const text = json.data.synopsis?.trim() || json.data.background?.trim();
    return text || 'No overview available.';
  } catch {
    return 'No overview available.';
  }
}

export function parseMalAnimeIdFromLink(link: string | undefined): number | null {
  if (!link) return null;
  const match = link.match(/myanimelist\.net\/anime\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function parseMalMangaIdFromLink(link: string | undefined): number | null {
  if (!link) return null;
  const match = link.match(/myanimelist\.net\/manga\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

/** @deprecated use parseMalAnimeIdFromLink */
export function parseMalIdFromLink(link: string | undefined): number | null {
  return parseMalAnimeIdFromLink(link);
}
