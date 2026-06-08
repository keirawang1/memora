import { useState } from 'react';
import type { MediaItem, Board } from '../types/media';
import type { DiscoveryItem } from '../types/discovery';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RecommendationCard } from './RecommendationCard';
import { TrendingUp, RefreshCw, WandSparklesIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed';
import { normalizeTitle } from '../data/recommendationEngine';

interface RecommendationsPageProps {
  mediaItems: MediaItem[];
  userId: string;
  boards: Board[];
  onAddMedia?: (
    media: Omit<MediaItem, 'id' | 'dateAdded'> & { id?: string },
    boardIds: string[],
  ) => void | Promise<void>;
}

function DiscoveryGridSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {['Anime', 'Manga'].map((label) => (
        <div key={label}>
          <div className="h-3 w-16 bg-muted rounded mb-2 animate-pulse" />
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col">
                <div className="aspect-square rounded-lg bg-muted mb-2" />
                <div className="h-4 bg-muted rounded mb-1 min-h-[2.5rem]" />
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-9 bg-muted rounded mt-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscoveryScrollGrid({
  primary,
  manga,
  boards,
  addedTitles,
  onAdd,
}: {
  primary: DiscoveryItem[];
  manga: DiscoveryItem[];
  boards: Board[];
  addedTitles: Set<string>;
  onAdd: (item: DiscoveryItem, boardIds: string[]) => void | Promise<void>;
}) {
  const renderRow = (items: DiscoveryItem[], label: string) => (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
        {label}
      </p>
      {items.length > 0 ? (
        <div className="grid grid-cols-5 gap-3 items-stretch">
          {items.slice(0, 5).map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              boards={boards}
              added={addedTitles.has(normalizeTitle(item.title))}
              onAdd={onAdd}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">Nothing here yet.</p>
      )}
    </div>
  );

  if (primary.length === 0 && manga.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No recommendations available right now.
      </p>
    );
  }

  return (
    <div className="max-h-[560px] overflow-y-auto pr-1">
      <div className="flex flex-col gap-5">
        {renderRow(primary, 'Anime')}
        {renderRow(manga, 'Manga')}
      </div>
    </div>
  );
}

export function RecommendationsPage({
  mediaItems,
  userId,
  boards,
  onAddMedia,
}: RecommendationsPageProps) {
  const {
    recommended,
    recommendedManga,
    trending,
    trendingManga,
    personalized,
    recommendedLoading,
    trendingLoading,
    error,
    refreshRecommended,
  } = useDiscoveryFeed(mediaItems, userId);
  const [addedTitles, setAddedTitles] = useState<Set<string>>(() => {
    return new Set(mediaItems.map((m) => normalizeTitle(m.title)));
  });

  const handleAdd = async (item: DiscoveryItem, boardIds: string[]) => {
    if (!onAddMedia || boardIds.length === 0) return;
    await onAddMedia(
      {
        title: item.title,
        type: item.type,
        genre: item.genres,
        status: 'not-started',
        imageUrl: item.imageUrl,
      },
      boardIds,
    );
    setAddedTitles((prev) => new Set([...prev, normalizeTitle(item.title)]));
  };

  const totalRecommended = recommended.length + recommendedManga.length;
  const totalTrending = trending.length + trendingManga.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">For You</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <WandSparklesIcon className="w-5 h-5" />
              Recommended For You
              {!recommendedLoading && totalRecommended > 0 
              }
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshRecommended}
              disabled={recommendedLoading}
              aria-label="Refresh recommendations"
            >
              <RefreshCw className={`w-4 h-4 ${recommendedLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {!personalized && (
            <p className="text-sm text-muted-foreground">
              Add more to your library for personalized picks
            </p>
          )}
        </CardHeader>
        <CardContent>
          {recommendedLoading ? (
            <DiscoveryGridSkeleton />
          ) : (
            <DiscoveryScrollGrid
              primary={recommended}
              manga={recommendedManga}
              boards={boards}
              addedTitles={addedTitles}
              onAdd={handleAdd}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5" />
            Trending Now
            {!trendingLoading && totalTrending > 0
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendingLoading ? (
            <DiscoveryGridSkeleton />
          ) : (
            <DiscoveryScrollGrid
              primary={trending}
              manga={trendingManga}
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
