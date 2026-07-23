import type { CandidateRow, CatalogMediaType, LikedItem } from '../types.js';
import { CANDIDATE_LIMIT, HIGH_RATING_THRESHOLD } from '../types.js';
import { getServiceClient } from '../lib/supabase.js';
import { averageVectors, normalizeTitle } from '../lib/utils.js';
import { embedText } from '../embed/local.js';
import { embeddingText } from '../lib/utils.js';

interface LibraryRow {
  media_id: string;
  title: string;
  type: string;
  rating: number | null;
  genres: string[] | null;
  link: string | null;
}

function mapLibraryType(type: string): CatalogMediaType | null {
  const t = type.trim().toLowerCase();
  if (t === 'anime') return 'anime';
  if (t === 'manga' || t === 'comic' || t === 'manhwa' || t === 'manhua' || t === 'light novel') {
    return 'manga';
  }
  if (t === 'movie') return 'movie';
  if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
  return null;
}

function parseExternalIdFromLink(link: string | null): { source: string; id: string } | null {
  if (!link) return null;
  const malAnime = link.match(/myanimelist\.net\/anime\/(\d+)/i);
  if (malAnime) return { source: 'jikan', id: malAnime[1] };
  const malManga = link.match(/myanimelist\.net\/manga\/(\d+)/i);
  if (malManga) return { source: 'jikan', id: malManga[1] };
  const tmdb = link.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdb) return { source: 'tmdb', id: tmdb[2] };
  return null;
}

export async function loadLikedItems(userId: string): Promise<LikedItem[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('media')
    .select('media_id, title, type, rating, genres, link')
    .eq('user_id', userId)
    .gt('rating', HIGH_RATING_THRESHOLD);
  if (error) throw error;

  return ((data ?? []) as LibraryRow[]).map((row) => ({
    mediaId: row.media_id,
    title: row.title,
    type: row.type,
    rating: Number(row.rating ?? 0),
    genres: row.genres ?? [],
    link: row.link,
  }));
}

export async function loadPreferredGenres(userId: string): Promise<string[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('users')
    .select('preferred_genres')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const genres = (data as { preferred_genres?: string[] } | null)?.preferred_genres;
  return Array.isArray(genres) ? genres : [];
}

export async function loadLibraryTitles(userId: string): Promise<string[]> {
  const sb = getServiceClient();
  const { data, error } = await sb.from('media').select('title').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: { title: string }) => normalizeTitle(r.title));
}

async function resolveCatalogEmbedding(
  like: LikedItem,
): Promise<{ values: number[]; weight: number; catalogId: string | null } | null> {
  const sb = getServiceClient();
  const parsed = parseExternalIdFromLink(like.link);
  if (parsed) {
    let query = sb
      .from('media_catalog')
      .select('id, embedding')
      .eq('external_id', parsed.id)
      .not('embedding', 'is', null);
    if (parsed.source === 'tmdb') {
      query = query.in('source', ['tmdb', 'movie_ratings']);
    } else {
      query = query.eq('source', parsed.source);
    }
    const { data } = await query.limit(1).maybeSingle();
    if (data?.embedding) {
      return {
        values: data.embedding as number[],
        weight: like.rating,
        catalogId: data.id as string,
      };
    }
  }

  const mediaType = mapLibraryType(like.type);
  let query = sb
    .from('media_catalog')
    .select('id, embedding')
    .ilike('title', like.title.trim())
    .not('embedding', 'is', null)
    .limit(1);
  if (mediaType) query = query.eq('media_type', mediaType);

  const { data: byTitle } = await query.maybeSingle();
  if (byTitle?.embedding) {
    return {
      values: byTitle.embedding as number[],
      weight: like.rating,
      catalogId: byTitle.id as string,
    };
  }

  // Ad-hoc embed — do not insert into catalog
  const values = await embedText(
    embeddingText({
      title: like.title,
      media_type: mediaType ?? like.type,
      genres: like.genres,
      synopsis: null,
    }),
  );
  return { values, weight: like.rating, catalogId: null };
}

export async function buildPreferenceVector(
  likes: LikedItem[],
  preferredGenres: string[],
): Promise<number[]> {
  if (likes.length > 0) {
    const resolved = await Promise.all(likes.map((l) => resolveCatalogEmbedding(l)));
    const vectors = resolved.filter(
      (v): v is { values: number[]; weight: number; catalogId: string | null } => v != null,
    );
    if (vectors.length > 0) return averageVectors(vectors);
  }

  // Cold start: embed preferred genres
  const genreText =
    preferredGenres.length > 0
      ? `Preferred genres: ${preferredGenres.join(', ')}`
      : 'Popular well-regarded entertainment across anime manga movies and tv';
  return embedText(genreText);
}

export async function fetchCandidates(
  preference: number[],
  excludeTitles: string[],
  perType = CANDIDATE_LIMIT,
  excludeIds: string[] = [],
): Promise<CandidateRow[]> {
  const sb = getServiceClient();
  const types: CatalogMediaType[] = ['anime', 'manga', 'movie', 'tv'];
  const merged = new Map<string, CandidateRow>();

  for (const mediaType of types) {
    const { data, error } = await sb.rpc('match_media_catalog', {
      query_embedding: preference,
      match_count: perType,
      filter_types: [mediaType],
      exclude_titles: excludeTitles,
      exclude_ids: excludeIds.length > 0 ? excludeIds : null,
    });
    if (error) throw error;
    for (const row of (data ?? []) as CandidateRow[]) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }
  }

  const all = [...merged.values()].sort((a, b) => a.distance - b.distance);
  // Cap combined pool ~100
  return all.slice(0, 100);
}
