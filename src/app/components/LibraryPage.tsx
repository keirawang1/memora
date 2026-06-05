import { useMemo, useState } from 'react';
import type { Board, MediaItem } from '../types/media';
import type { SortMode } from '../types/sort';
import { BoardCard } from './BoardCard';
import { SearchFilterBar } from './SearchFilterBar';
import { SortOrderControl } from './SortOrderControl';
import { ReorderableGrid } from './ReorderableGrid';
import { Plus } from 'lucide-react';
import { getBoardMediaItems } from '../data/allBoard';
import {
  boardMatchesTypeFilter,
  formatMediaTypeLabel,
  getBoardMediaTypeOptions,
} from '../data/mediaOptions';
import { sortBoardsForDisplay } from '../data/sortOrder';

interface LibraryPageProps {
  boards: Board[];
  mediaItems: MediaItem[];
  onBoardClick: (board: Board) => void;
  onCreateBoard?: () => void;
  accentColor?: string;
  customMediaTypes: string[];
  boardSortMode: SortMode;
  boardCustomOrder: string[];
  onBoardSortModeChange: (mode: SortMode) => void | Promise<void>;
  onBoardCustomOrderChange: (order: string[]) => void | Promise<void>;
}

export function LibraryPage({
  boards,
  mediaItems,
  onBoardClick,
  onCreateBoard,
  accentColor = '#5C2B17',
  customMediaTypes,
  boardSortMode,
  boardCustomOrder,
  onBoardSortModeChange,
  onBoardCustomOrderChange,
}: LibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const mediaTypeOptions = useMemo(
    () => getBoardMediaTypeOptions(customMediaTypes),
    [customMediaTypes],
  );

  const filteredBoards = useMemo(
    () =>
      boards.filter((board) => {
        const matchesSearch = board.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesType = boardMatchesTypeFilter(board, typeFilters);
        return matchesSearch && matchesType;
      }),
    [boards, searchQuery, typeFilters],
  );

  const sortedBoards = useMemo(
    () =>
      sortBoardsForDisplay(filteredBoards, boardSortMode, boardCustomOrder),
    [filteredBoards, boardSortMode, boardCustomOrder],
  );

  const sortedBoardIds = useMemo(
    () => sortedBoards.map((b) => b.id),
    [sortedBoards],
  );

  const boardById = useMemo(
    () => new Map(sortedBoards.map((b) => [b.id, b])),
    [sortedBoards],
  );

  const hasActiveFilters = typeFilters.length > 0;

  const handleSortModeChange = (mode: SortMode) => {
    void onBoardSortModeChange(mode);
  };

  const handleReorder = async (nextIds: string[]) => {
    const visibleSet = new Set(sortedBoardIds);
    const reorderedVisible = nextIds.filter((id) => visibleSet.has(id));
    const hidden = boardCustomOrder.filter((id) => !visibleSet.has(id));
    await onBoardCustomOrderChange([...reorderedVisible, ...hidden]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2">Your Boards</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <SortOrderControl mode={boardSortMode} onModeChange={handleSortModeChange} />
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

      {sortedBoards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'No boards match your search or filters.'
              : 'No boards found. Create a new board to get started!'}
          </p>
        </div>
      ) : (
        <ReorderableGrid
          enabled={boardSortMode === 'custom'}
          itemIds={sortedBoardIds}
          onReorder={(ids) => void handleReorder(ids)}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
        >
          {(boardId) => {
            const board = boardById.get(boardId);
            if (!board) return null;
            const itemCount = getBoardMediaItems(board, mediaItems).length;
            return (
              <BoardCard
                board={board}
                itemCount={itemCount}
                accentColor={accentColor}
                onClick={() => onBoardClick(board)}
              />
            );
          }}
        </ReorderableGrid>
      )}
    </div>
  );
}
