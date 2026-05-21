import { useState } from 'react';
import { Board, MediaItem } from '../types/media';
import { BoardCard } from './BoardCard';
import { Input } from './ui/input';
import { Plus } from 'lucide-react';

interface LibraryPageProps {
  boards: Board[];
  mediaItems: MediaItem[];
  onBoardClick: (board: Board) => void;
  onCreateBoard?: () => void;
  accentColor?: string;
}

export function LibraryPage({ boards, mediaItems, onBoardClick, onCreateBoard, accentColor = '#5C2B17' }: LibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2">Your Boards</h1>
        <p className="text-muted-foreground">Mix and match your media</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search boards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <button 
          onClick={onCreateBoard}
          className="px-4 py-2 rounded-md text-white hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-4 h-4" />
          New Board
        </button>
      </div>

      {filteredBoards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No boards found. Create a new board to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredBoards.map((board) => {
            const itemCount = board.mediaIds.length;
            return (
              <BoardCard
                key={board.id}
                board={board}
                itemCount={itemCount}
                onClick={() => onBoardClick(board)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
