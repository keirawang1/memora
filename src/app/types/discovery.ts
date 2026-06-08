export type DiscoverySource = 'jikan';

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
  recommendedManga: DiscoveryItem[];
  trending: DiscoveryItem[];
  trendingManga: DiscoveryItem[];
  seed: DiscoverySeed | null;
  cacheKey: string;
}
