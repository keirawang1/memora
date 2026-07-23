import { supabase } from './client';
import type {
  CachedRecommendationItem,
  UserRecommendationsRow,
} from '../types/recommendations';
import type { DiscoveryItem } from '../types/discovery';

function formatLabel(mediaType: string, fallback?: string): string {
  if (fallback) return fallback.toUpperCase();
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

export function cachedRecToDiscoveryItem(item: CachedRecommendationItem): DiscoveryItem {
  const externalNumeric = Number(item.external_id);
  return {
    id: `rec-${item.catalog_id}`,
    externalId: Number.isFinite(externalNumeric) ? externalNumeric : 0,
    source:
      item.source === 'movie_ratings'
        ? 'movie_ratings'
        : item.source === 'tmdb'
          ? 'tmdb'
          : 'jikan',
    title: item.title,
    imageUrl: item.image_url ?? '',
    type: item.media_type,
    genres: item.genres ?? [],
    link: item.link ?? '',
    formatLabel: formatLabel(item.media_type, item.format_label),
    reason: item.reason,
    sourceLikes: item.source_likes ?? [],
    catalogId: item.catalog_id,
  };
}

export async function fetchUserRecommendations(
  userId: string,
): Promise<UserRecommendationsRow | null> {
  const { data, error } = await supabase
    .from('user_recommendations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as UserRecommendationsRow;
}

export async function refreshRecommendations(force = false): Promise<{
  items: CachedRecommendationItem[];
  cached: boolean;
}> {
  const { data, error } = await supabase.functions.invoke('refresh-recommendations', {
    body: { force },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    items: (data?.items as CachedRecommendationItem[]) ?? [],
    cached: Boolean(data?.cached),
  };
}
