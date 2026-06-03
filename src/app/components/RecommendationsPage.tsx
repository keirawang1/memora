import { useState } from 'react';
import type { MediaItem, Board } from '../types/media';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { MediaCard } from './MediaCard';
import { Sparkles, TrendingUp, Star, Heart, Flame, Zap, Plus, Circle, CheckCircle2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';

interface RecommendationsPageProps {
  recommendations: MediaItem[];
  onMediaClick: (media: MediaItem) => void;
  boards: Board[];
  onAddMedia?: (media: MediaItem, boardIds: string[]) => void;
}

export function RecommendationsPage({ recommendations, onMediaClick, boards, onAddMedia }: RecommendationsPageProps) {
  const recommendedIcons = [Star, Heart, Flame, Zap];
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<Record<string, string[]>>({});

  const availableBoards = boards.filter((board) => !board.isSystem && board.name !== 'All');

  const handleBoardToggle = (itemId: string, boardId: string) => {
    setSelectedBoards(prev => {
      const currentBoards = prev[itemId] || [];
      const isSelected = currentBoards.includes(boardId);
      return {
        ...prev,
        [itemId]: isSelected
          ? currentBoards.filter(id => id !== boardId)
          : [...currentBoards, boardId]
      };
    });
  };

  const handleAddMedia = (item: MediaItem) => {
    const boardIds = selectedBoards[item.id] || [];
    if (onAddMedia && boardIds.length > 0) {
      onAddMedia(item, boardIds);
    }
    setOpenPopoverId(null);
  };
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="mb-2 flex items-center gap-2">
          <Sparkles className="w-8 h-8" />
          Recommendations
        </h1>
        <p className="text-muted-foreground">
          Personalized suggestions based on your history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recommended For You
            <Badge variant="secondary">{recommendations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Start watching more content to get personalized recommendations!
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trending Now</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              Trending content will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
