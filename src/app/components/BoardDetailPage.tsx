import { useMemo, useState } from 'react';
import type { Board, MediaItem, WatchStatus } from '../types/media';
import type { SortMode } from '../types/sort';
import { isAllBoard } from '../data/allBoard';
import { sortMediaForDisplay } from '../data/sortOrder';
import { MediaCard } from './MediaCard';
import { SortOrderControl } from './SortOrderControl';
import { ReorderableGrid } from './ReorderableGrid';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SearchFilterBar } from './SearchFilterBar';
import { MediaTypeSelectDropdown } from './MediaTypeSelectDropdown';
import { ArrowLeft, Globe, Lock, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Upload } from 'lucide-react';
import {
  BOARD_TYPE_MIXED,
  DEFAULT_GENRES,
  DEFAULT_MEDIA_TYPES,
  formatMediaTypeLabel,
  formatWatchStatusLabel,
  getBoardMediaTypeOptions,
} from '../data/mediaOptions';

interface BoardDetailPageProps {
  board: Board;
  mediaItems: MediaItem[];
  onBack: () => void;
  onMediaClick: (media: MediaItem) => void;
  onUpdateBoard: (
    boardId: string,
    updates: Partial<Board> & { coverImageDataUrl?: string },
  ) => void | Promise<void>;
  customMediaTypes: string[];
  customGenres: string[];
  onDeleteBoard?: (boardId: string) => void;
  readOnly?: boolean;
  mediaSortMode: SortMode;
  onMediaSortModeChange: (mode: SortMode) => void | Promise<void>;
  onBoardMediaOrderChange: (boardId: string, mediaIds: string[]) => void | Promise<void>;
}

const watchStatuses: WatchStatus[] = ['completed', 'in-progress', 'not-started', 'dropped'];

export function BoardDetailPage({ 
  board, 
  mediaItems, 
  onBack, 
  onMediaClick,
  onUpdateBoard,
  onDeleteBoard,
  customMediaTypes,
  customGenres,
  readOnly = false,
  mediaSortMode,
  onMediaSortModeChange,
  onBoardMediaOrderChange,
}: BoardDetailPageProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(board.isPublic);
  const [boardName, setBoardName] = useState(board.name);
  const [boardDescription, setBoardDescription] = useState(board.description || '');
  const [boardMediaType, setBoardMediaType] = useState(board.type || BOARD_TYPE_MIXED);
  const mediaTypeOptions = getBoardMediaTypeOptions(customMediaTypes);
  const [boardImageUpload, setBoardImageUpload] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilters, setGenreFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const readOnlyBoard = readOnly || isAllBoard(board);

  const allGenres = useMemo(
    () => [...DEFAULT_GENRES, ...customGenres],
    [customGenres],
  );

  const allMediaTypes = useMemo(
    () => [...DEFAULT_MEDIA_TYPES, ...customMediaTypes],
    [customMediaTypes],
  );

  const hasActiveFilters =
    genreFilters.length > 0 || typeFilters.length > 0 || statusFilters.length > 0;

  const filteredMediaItems = useMemo(
    () =>
      mediaItems.filter((item) => {
        const matchesSearch = item.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesGenre =
          genreFilters.length === 0 ||
          item.genre.some((g) => genreFilters.includes(g));
        const matchesType =
          typeFilters.length === 0 || typeFilters.includes(item.type);
        const matchesStatus =
          statusFilters.length === 0 || statusFilters.includes(item.status);
        return matchesSearch && matchesGenre && matchesType && matchesStatus;
      }),
    [mediaItems, searchQuery, genreFilters, typeFilters, statusFilters],
  );

  const customMediaOrder = board.mediaIds;

  const sortedMediaItems = useMemo(
    () =>
      sortMediaForDisplay(filteredMediaItems, mediaSortMode, customMediaOrder),
    [filteredMediaItems, mediaSortMode, customMediaOrder],
  );

  const sortedMediaIds = useMemo(
    () => sortedMediaItems.map((m) => m.id),
    [sortedMediaItems],
  );

  const mediaById = useMemo(
    () => new Map(sortedMediaItems.map((m) => [m.id, m])),
    [sortedMediaItems],
  );

  const handleMediaSortModeChange = (mode: SortMode) => {
    void onMediaSortModeChange(mode);
  };

  const handleMediaReorder = async (nextVisibleIds: string[]) => {
    const visibleSet = new Set(sortedMediaIds);
    const reorderedVisible = nextVisibleIds.filter((id) => visibleSet.has(id));
    const hidden = board.mediaIds.filter((id) => !visibleSet.has(id));
    await onBoardMediaOrderChange(board.id, [...reorderedVisible, ...hidden]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBoardImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = () => {
    onUpdateBoard(board.id, {
      isPublic,
      name: boardName,
      description: boardDescription,
      type: boardMediaType,
      ...(boardImageUpload && { coverImageDataUrl: boardImageUpload }),
    });
    setEditDialogOpen(false);
  };

  const handleDeleteBoard = () => {
    onDeleteBoard?.(board.id);
    setDeleteDialogOpen(false);
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1>{board.name}</h1>
              {board.isPublic ? (
                <Badge className="bg-green-500 text-white">
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge className="bg-gray-500 text-white">
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {mediaItems.length} {mediaItems.length === 1 ? 'item' : 'items'}
            </p>
            {board.description && (
              <p className="text-muted-foreground text-sm mt-1">
                {board.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <SortOrderControl
            mode={mediaSortMode}
            onModeChange={handleMediaSortModeChange}
          />
          <SearchFilterBar
            placeholder="Search media..."
            value={searchQuery}
            onChange={setSearchQuery}
            filterOpen={filterOpen}
            onFilterOpenChange={setFilterOpen}
            hasActiveFilters={hasActiveFilters}
            sections={[
              {
                title: 'Genre',
                options: allGenres,
                selected: genreFilters,
                onChange: setGenreFilters,
              },
              {
                title: 'Media type',
                options: allMediaTypes,
                selected: typeFilters,
                onChange: setTypeFilters,
                formatLabel: formatMediaTypeLabel,
              },
              {
                title: 'Status',
                options: watchStatuses,
                selected: statusFilters,
                onChange: setStatusFilters,
                formatLabel: formatWatchStatusLabel,
              },
            ]}
          />

          {!readOnlyBoard && (
          <>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Board</DialogTitle>
              <DialogDescription className="sr-only">
                Edit board details including name, description, visibility, and cover image
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="boardName">Board Name</Label>
                <Input
                  id="boardName"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="boardMediaType">Media Type</Label>
                <MediaTypeSelectDropdown
                  id="boardMediaType"
                  options={mediaTypeOptions}
                  value={boardMediaType}
                  onChange={setBoardMediaType}
                />
              </div>

              <div className="space-y-2">
                <Label>Board Cover Image</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="board-edit-image-upload"
                  />
                  <label htmlFor="board-edit-image-upload" className="cursor-pointer block">
                    {boardImageUpload ? (
                      <div>
                        <img 
                          src={boardImageUpload} 
                          alt="Preview" 
                          className="max-h-32 mx-auto rounded mb-2"
                        />
                        <p className="text-sm text-muted-foreground">Click to change image</p>
                      </div>
                    ) : board.coverImage ? (
                      <div>
                        <img 
                          src={board.coverImage} 
                          alt="Current" 
                          className="max-h-32 mx-auto rounded mb-2"
                        />
                        <p className="text-sm text-muted-foreground">Click to change image</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm">Click to upload an image</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="boardDescription">Description</Label>
                <Textarea
                  id="boardDescription"
                  value={boardDescription}
                  onChange={(e) => setBoardDescription(e.target.value)}
                  placeholder="Add a description for this board..."
                  rows={3}
                  className="h-20"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-board-public">Public Board</Label>
                  <div className="text-sm text-muted-foreground">
                    Allow others to see this board
                  </div>
                </div>
                <Switch
                  id="edit-board-public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  setEditDialogOpen(false);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Board
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the board "{board.name}" and remove all media from it. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteBoard}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Board
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </>
          )}
        </div>
      </div>

      {sortedMediaItems.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'No media matches your search or filters.'
              : 'This board is empty. Add some media to get started!'}
          </p>
        </div>
      ) : (
        <ReorderableGrid
          enabled={mediaSortMode === 'custom' && !readOnlyBoard}
          itemIds={sortedMediaIds}
          onReorder={(ids) => void handleMediaReorder(ids)}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
        >
          {(mediaId) => {
            const item = mediaById.get(mediaId);
            if (!item) return null;
            return (
              <MediaCard
                media={item}
                onClick={() => onMediaClick(item)}
              />
            );
          }}
        </ReorderableGrid>
      )}
    </div>
  );
}
