export type CatalogSource = 'jikan' | 'movie_ratings' | 'tmdb';
export type CatalogMediaType = 'anime' | 'manga' | 'movie' | 'tv';

export interface CatalogUpsertRow {
  source: CatalogSource;
  external_id: string;
  media_type: CatalogMediaType;
  title: string;
  synopsis: string | null;
  genres: string[];
  image_url: string | null;
  external_url: string | null;
  metadata: Record<string, unknown>;
  content_hash: string;
}

export interface CatalogRow extends CatalogUpsertRow {
  id: string;
  embedding: number[] | null;
  embedded_at: string | null;
}

export interface CandidateRow {
  id: string;
  source: CatalogSource;
  external_id: string;
  media_type: CatalogMediaType;
  title: string;
  synopsis: string | null;
  genres: string[];
  image_url: string | null;
  external_url: string | null;
  metadata: Record<string, unknown>;
  distance: number;
}

export interface LikedItem {
  mediaId: string;
  title: string;
  type: string;
  rating: number;
  genres: string[];
  link: string | null;
}

export interface RecommendationItem {
  catalog_id: string;
  title: string;
  media_type: CatalogMediaType;
  image_url: string | null;
  link: string | null;
  genres: string[];
  source: CatalogSource;
  external_id: string;
  reason: string;
  source_likes: string[];
  format_label: string;
}

export const EMBEDDING_DIMS = 384;
export const CANDIDATE_LIMIT = 80;
export const FINAL_PICK_COUNT = 4;
export const HIGH_RATING_THRESHOLD = 4;
export const REC_TTL_HOURS = 24;
