import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Plus, X, Upload, Star } from 'lucide-react';
import type { MediaType, WatchStatus, Genre, Board } from '../types/media';
import { BoardMultiSelect } from './BoardMultiSelect';
import { GenreSelectDropdown } from './GenreSelectDropdown';
import { isAllBoard } from '../data/allBoard';
import {
  DEFAULT_GENRES,
  DEFAULT_MEDIA_TYPES,
  formatMediaTypeLabel,
} from '../data/mediaOptions';

interface AddMediaDialogProps {
  onAdd: (media: any, boardIds?: string[]) => void | Promise<void>;
  boards: Board[];
  currentBoardId?: string;
  customGenres: string[];
  customMediaTypes: string[];
  accentColor?: string;
}

const watchStatuses: WatchStatus[] = ['completed', 'ongoing', 'not-started', 'dropped'];

export function AddMediaDialog({
  onAdd,
  boards,
  currentBoardId,
  customGenres,
  customMediaTypes,
  accentColor = '#5C2B17',
}: AddMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MediaType>('movie');
  const [status, setStatus] = useState<WatchStatus>('not-started');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [imageUpload, setImageUpload] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [dateStarted, setDateStarted] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const isSelectable =
        currentBoardId && boards.find((b) => b.id === currentBoardId && !isAllBoard(b));
      setSelectedBoards(isSelectable ? [currentBoardId] : []);
    } else {
      setSelectedBoards([]);
    }
  }, [open, currentBoardId, boards]);

  const handleRemoveGenre = (genre: Genre) => {
    setSelectedGenres(selectedGenres.filter((g) => g !== genre));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAdd(
        {
          title,
          type,
          genre: selectedGenres,
          status,
          imageUrl: imageUpload || '',
          rating: rating > 0 ? rating : undefined,
          dateStarted: dateStarted || undefined,
          dateCompleted: dateCompleted || undefined,
          notes,
        },
        selectedBoards,
      );

      setTitle('');
      setType('movie');
      setStatus('not-started');
      setSelectedGenres([]);
      setImageUpload('');
      setRating(0);
      setNotes('');
      setSelectedBoards([]);
      setDateStarted('');
      setDateCompleted('');
      setOpen(false);
    } catch {
      // Error toast handled in App.handleAddMedia
    } finally {
      setIsSubmitting(false);
    }
  };

  const allGenres = useMemo(
    () => [...DEFAULT_GENRES, ...customGenres],
    [customGenres],
  );

  const allMediaTypes = useMemo(
    () => [...DEFAULT_MEDIA_TYPES, ...customMediaTypes],
    [customMediaTypes],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded-full fixed bottom-6 right-6 h-14 w-14 shadow-lg z-50 hover:opacity-90 transition-opacity flex items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add New Media</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <BoardMultiSelect
            boards={boards}
            selectedBoardIds={selectedBoards}
            onChange={setSelectedBoards}
            label="Add to Boards"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Media Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allMediaTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatMediaTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as WatchStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {watchStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genres</Label>
            <GenreSelectDropdown
              genres={allGenres}
              selectedGenres={selectedGenres}
              onChange={setSelectedGenres}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedGenres.map((genre) => (
                <Badge key={genre} variant="secondary" className="gap-1">
                  {genre}
                  <button
                    type="button"
                    className="ml-1 rounded-full hover:bg-black/10 focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveGenre(genre);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-started">Start Date</Label>
              <Input
                id="date-started"
                type="date"
                value={dateStarted}
                onChange={(e) => setDateStarted(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-completed">Completed Date</Label>
              <Input
                id="date-completed"
                type="date"
                value={dateCompleted}
                onChange={(e) => setDateCompleted(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer block">
                {imageUpload ? (
                  <div>
                    <img
                      src={imageUpload}
                      alt="Preview"
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
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star === rating ? 0 : star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add your thoughts..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add Media'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
