import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Plus, X } from 'lucide-react';
import { StarRating } from './StarRating';
import type { MediaType, WatchStatus, Genre, Board } from '../types/media';
import { BoardMultiSelect } from './BoardMultiSelect';
import { GenreSelectDropdown } from './GenreSelectDropdown';
import { MediaTypeSelectDropdown } from './MediaTypeSelectDropdown';
import { CoverImageUpload } from './CoverImageUpload';
import { isAllBoard } from '../data/allBoard';
import {
  DEFAULT_GENRES,
  DEFAULT_MEDIA_TYPES,
} from '../data/mediaOptions';
import { accentButtonStyle } from '../utils/accentColor';

interface AddMediaDialogProps {
  onAdd: (media: any, boardIds?: string[]) => void | Promise<void>;
  boards: Board[];
  currentBoardId?: string;
  customGenres: string[];
  customMediaTypes: string[];
  onOpenChange?: (open: boolean) => void;
}

const watchStatuses: WatchStatus[] = ['completed', 'in-progress', 'not-started', 'dropped'];

export function AddMediaDialog({
  onAdd,
  boards,
  currentBoardId,
  customGenres,
  customMediaTypes,
  onOpenChange,
}: AddMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MediaType>('movie');
  const [status, setStatus] = useState<WatchStatus>('not-started');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [imageUpload, setImageUpload] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [dateStarted, setDateStarted] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

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
          link: link.trim() || undefined,
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
      setLink('');
      setSelectedBoards([]);
      setDateStarted('');
      setDateCompleted('');
      handleOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          id="onboarding-add-media"
          type="button"
          style={accentButtonStyle}
          className="rounded-full fixed bottom-6 right-6 h-14 w-14 shadow-lg z-[90] hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
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
              <MediaTypeSelectDropdown
                id="type"
                options={allMediaTypes}
                value={type}
                onChange={setType}
              />
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

          <div className="space-y-2">
            <Label htmlFor="link">Link</Label>
            <Input
              id="link"
              type="url"
              placeholder="https://..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="text-sm"
            />
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

          <CoverImageUpload
            label="Image"
            inputId="image-upload"
            value={imageUpload}
            onChange={setImageUpload}
          />

          <div className="space-y-2">
            <Label>Rating</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add your thoughts..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="h-20"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSubmit} style={accentButtonStyle} disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add Media'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
