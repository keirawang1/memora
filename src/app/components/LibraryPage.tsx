import { useMemo, useState } from 'react';
import type { Board } from '../types/media';
import { BoardCard } from './BoardCard';
import { SearchFilterBar } from './SearchFilterBar';
import { Plus } from 'lucide-react';
import {
  boardMatchesTypeFilter,
  formatMediaTypeLabel,
  getBoardMediaTypeOptions,
} from '../data/mediaOptions';

interface LibraryPageProps {
  boards: Board[];
  onBoardClick: (board: Board) => void;
  onCreateBoard?: () => void;
  accentColor?: string;
  customMediaTypes: string[];
}

export function LibraryPage({
  boards,
  onBoardClick,
  onCreateBoard,
  accentColor = '#5C2B17',
  customMediaTypes,
}: LibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const mediaTypeOptions = useMemo(
    () => getBoardMediaTypeOptions(customMediaTypes),
    [customMediaTypes],
  );

  const filteredBoards = boards.filter((board) => {
    const matchesSearch = board.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = boardMatchesTypeFilter(board, typeFilters);
    return matchesSearch && matchesType;
  });

  const hasActiveFilters = typeFilters.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2">Your Boards</h1>
        <p className="text-muted-foreground">Mix and match your media</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SearchFilterBar
          placeholder="Search boards..."
          value={searchQuery}
          onChange={setSearchQuery}
          filterOpen={filterOpen}
          onFilterOpenChange={setFilterOpen}
          hasActiveFilters={hasActiveFilters}
          sections={[
            {
              title: 'Media type',
              options: mediaTypeOptions,
              selected: typeFilters,
              onChange: setTypeFilters,
              formatLabel: formatMediaTypeLabel,
            },
          ]}
        />
        <button
          onClick={onCreateBoard}
          className="px-4 py-2 rounded-md text-white hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-4 h-4" />
          New Board
        </button>
      </div>

      {filteredBoards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'No boards match your search or filters.'
              : 'No boards found. Create a new board to get started!'}
          </p>
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
