export interface CachedRecommendationItem {
  catalog_id: string;
  title: string;
  media_type: 'anime' | 'manga' | 'movie' | 'tv' | string;
  image_url: string | null;
  link: string | null;
  genres: string[];
  source: 'jikan' | 'movie_ratings' | 'tmdb' | string;
  external_id: string;
  reason: string;
  source_likes: string[];
  format_label: string;
}

export interface UserRecommendationsRow {
  user_id: string;
  items: CachedRecommendationItem[];
  candidate_ids: string[];
  input_fingerprint: string | null;
  generated_at: string;
  expires_at: string;
}
