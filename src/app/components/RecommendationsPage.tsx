import { useState } from 'react';
import type { MediaItem, Board } from '../types/media';
import type { DiscoveryItem } from '../types/discovery';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RecommendationCard } from './RecommendationCard';
import { TrendingUp, RefreshCw, WandSparklesIcon } from 'lucide-react';
import { Button } from './ui/button';
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed';
import { normalizeTitle } from '../data/recommendationEngine';
import { DEFAULT_GENRES } from '../data/mediaOptions';

interface RecommendationsPageProps {
  mediaItems: MediaItem[];
  userId: string;
  boards: Board[];
  preferredGenres?: string[];
  preferredMediaTypes?: string[];
  customMediaTypes?: string[];
  customGenres?: string[];
  /** Cap how many times the refresh button can hit live APIs (e.g. demo). */
  maxRefreshes?: number;
  /** Show a demo-mode limitations note. */
  demoMode?: boolean;
  onAddMedia?: (
    media: Omit<MediaItem, 'id' | 'dateAdded'> & { id?: string },
    boardIds: string[],
  ) => void | Promise<void>;
}

function QuadGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse flex flex-col">
          <div className="aspect-[2/3] rounded-lg bg-muted mb-3" />
          <div className="h-5 bg-muted rounded mb-2" />
          <div className="h-3 bg-muted rounded w-1/3 mb-2" />
          <div className="h-10 bg-muted rounded mt-auto" />
        </div>
      ))}
    </div>
  );
}

function QuadGrid({
  items,
  boards,
  addedTitles,
  onAdd,
  showReasons,
}: {
  items: DiscoveryItem[];
  boards: Board[];
  addedTitles: Set<string>;
  onAdd: (item: DiscoveryItem, boardIds: string[]) => void | Promise<void>;
  showReasons?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No recommendations available right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 items-stretch">
      {items.slice(0, 4).map((item) => (
        <RecommendationCard
          key={item.id}
          item={item}
          boards={boards}
          added={addedTitles.has(normalizeTitle(item.title))}
          onAdd={onAdd}
          showReason={showReasons}
          large
        />
      ))}
    </div>
  );
}

export function RecommendationsPage({
  mediaItems,
  userId,
  boards,
  preferredGenres = [],
  preferredMediaTypes = [],
  customMediaTypes = [],
  customGenres = [],
  maxRefreshes,
  demoMode = false,
  onAddMedia,
}: RecommendationsPageProps) {
  const liveFeed = useDiscoveryFeed(
    mediaItems,
    userId,
    preferredGenres,
    customMediaTypes,
    preferredMediaTypes,
  );

  const [refreshCount, setRefreshCount] = useState(0);
  const refreshLimitReached =
    typeof maxRefreshes === 'number' && refreshCount >= maxRefreshes;

  const recommended = liveFeed.recommended;
  const trending = liveFeed.trending;
  const personalized = liveFeed.personalized;
  const recommendedLoading = liveFeed.recommendedLoading;
  const trendingLoading = liveFeed.trendingLoading;

  const handleRefresh = () => {
    if (refreshLimitReached || recommendedLoading) return;
    setRefreshCount((n) => n + 1);
    liveFeed.refreshRecommended();
  };

  const [addedTitles, setAddedTitles] = useState<Set<string>>(() => {
    return new Set(mediaItems.map((m) => normalizeTitle(m.title)));
  });

  const userGenres = new Set(
    [...DEFAULT_GENRES, ...customGenres].map((g) => g.toLowerCase()),
  );

  const handleAdd = async (item: DiscoveryItem, boardIds: string[]) => {
    if (!onAddMedia || boardIds.length === 0) return;
    await onAddMedia(
      {
        title: item.title,
        type: item.type,
        genre: item.genres.filter((g) => userGenres.has(g.toLowerCase())),
        status: 'not-started',
        imageUrl: item.imageUrl,
      },
      boardIds,
    );
    setAddedTitles((prev) => new Set([...prev, normalizeTitle(item.title)]));
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">For You</h1>
        {demoMode && (
          <p className="text-sm text-muted-foreground">
            Recommendations are limited in demo mode — refreshes are capped.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <WandSparklesIcon className="w-5 h-5" />
              Recommended For You
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={recommendedLoading || refreshLimitReached}
              aria-label={
                refreshLimitReached
                  ? 'Refresh limit reached'
                  : 'Refresh recommendations'
              }
              title={
                refreshLimitReached
                  ? typeof maxRefreshes === 'number'
                    ? `Refresh limit reached (${maxRefreshes})`
                    : 'Refresh limit reached'
                  : undefined
              }
            >
              <RefreshCw className={`w-4 h-4 ${recommendedLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {!personalized && (
            <p className="text-sm text-muted-foreground">
              Start adding more media to your library for personalized picks!
            </p>
          )}
        </CardHeader>
        <CardContent>
          {recommendedLoading ? (
            <QuadGridSkeleton />
          ) : (
            <QuadGrid
              items={recommended}
              boards={boards}
              addedTitles={addedTitles}
              onAdd={handleAdd}
              showReasons
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5" />
            Trending Now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendingLoading ? (
            <QuadGridSkeleton />
          ) : (
            <QuadGrid
              items={trending}
              boards={boards}
              addedTitles={addedTitles}
              onAdd={handleAdd}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
