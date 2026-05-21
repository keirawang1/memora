import { Board } from '../types/media';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Plus } from 'lucide-react';

interface BoardCardProps {
  board: Board;
  itemCount: number;
  onClick?: () => void;
}

export function BoardCard({ board, itemCount, onClick }: BoardCardProps) {
  const isEmptyWatchlist = board.name === 'Watchlist' && itemCount === 0;
  
  return (
    <div
      className="group cursor-pointer transition-all hover:scale-105"
      onClick={onClick}
    >
      <div className="aspect-square relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg overflow-hidden mb-2">
        {isEmptyWatchlist ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <Plus className="w-12 h-12 text-muted-foreground/40" />
          </div>
        ) : (
          <ImageWithFallback
            src={board.coverImage || ''}
            alt={board.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      <div>
        <h3 className="text-sm line-clamp-1 mb-0.5">{board.name}</h3>
        <div className="text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </div>
      </div>
    </div>
  );
}
