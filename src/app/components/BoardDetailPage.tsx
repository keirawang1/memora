import { useState } from 'react';
import type { Board, MediaItem } from '../types/media';
import { MediaCard } from './MediaCard';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ArrowLeft, Globe, Lock, Pencil, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload } from 'lucide-react';

interface BoardDetailPageProps {
  board: Board;
  mediaItems: MediaItem[];
  onBack: () => void;
  onMediaClick: (media: MediaItem) => void;
  onUpdateBoard: (boardId: string, updates: Partial<Board> & { mediaType?: string }) => void;
  onDeleteBoard?: (boardId: string) => void;
}

export function BoardDetailPage({ 
  board, 
  mediaItems, 
  onBack, 
  onMediaClick,
  onUpdateBoard,
  onDeleteBoard 
}: BoardDetailPageProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(board.isPublic);
  const [boardName, setBoardName] = useState(board.name);
  const [boardDescription, setBoardDescription] = useState(board.description || '');
  const [boardMediaType, setBoardMediaType] = useState((board as any).mediaType || 'mixed');
  const [boardImageUpload, setBoardImageUpload] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMediaItems = mediaItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      mediaType: boardMediaType,
      ...(boardImageUpload && { coverImage: boardImageUpload }),
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

        <div className="flex gap-2">
          <Input
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />

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
                <Select value={boardMediaType} onValueChange={setBoardMediaType}>
                  <SelectTrigger id="boardMediaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['movie', 'tv', 'anime', 'comic', 'book', 'mixed'].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === 'tv' ? 'TV Show' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>

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
      </div>

      {filteredMediaItems.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            {searchQuery ? 'No media found matching your search.' : 'This board is empty. Add some media to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredMediaItems.map((item) => (
            <MediaCard 
              key={item.id} 
              media={item}
              onClick={() => onMediaClick(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
