export type DiscoverySource = 'jikan' | 'movie_ratings' | 'tmdb';

export interface DiscoveryItem {
  id: string;
  externalId: number;
  source: DiscoverySource;
  title: string;
  imageUrl: string;
  type: string;
  genres: string[];
  link: string;
  formatLabel: string;
  reason?: string;
  sourceLikes?: string[];
  catalogId?: string;
}

export interface DiscoverySeed {
  mediaId: string;
  title: string;
  type: string;
  externalId: number | null;
  source: DiscoverySource | null;
}

export interface DiscoverySectionRows {
  primary: DiscoveryItem[];
  manga: DiscoveryItem[];
}

export interface DiscoveryFeed {
  recommended: DiscoveryItem[];
  trending: DiscoveryItem[];
  seed: DiscoverySeed | null;
  cacheKey: string;
}
