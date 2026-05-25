import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Plus, X, Upload, Star, Circle, CheckCircle2 } from 'lucide-react';
import type { MediaType, WatchStatus, Genre, Board } from '../types/media';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface AddMediaDialogProps {
  onAdd: (media: any, boardIds?: string[]) => void;
  boards: Board[];
  customGenres: string[];
  customMediaTypes: string[];
  onAddCustomGenre: (genre: string) => void;
  onAddCustomMediaType: (type: string) => void;
  accentColor?: string;
}

const defaultMediaTypes: string[] = ['movie', 'tv', 'anime', 'comic', 'book'];
const watchStatuses: WatchStatus[] = ['watched', 'watching', 'want-to-watch', 'dropped'];
const defaultGenres: string[] = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Fantasy', 'Horror', 'Romance', 'Thriller', 'Historical', 'Mystery'];

export function AddMediaDialog({ onAdd, boards, customGenres, customMediaTypes, onAddCustomGenre, onAddCustomMediaType, accentColor = '#5C2B17' }: AddMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MediaType>('movie');
  const [status, setStatus] = useState<WatchStatus>('want-to-watch');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [imageUpload, setImageUpload] = useState<string>('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [boardSearchOpen, setBoardSearchOpen] = useState(false);
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [dateStarted, setDateStarted] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');
  const [showAddGenreDialog, setShowAddGenreDialog] = useState(false);
  const [showAddMediaTypeDialog, setShowAddMediaTypeDialog] = useState(false);
  const [newGenreInput, setNewGenreInput] = useState('');
  const [newMediaTypeInput, setNewMediaTypeInput] = useState('');

  const handleAddGenre = (genre: Genre) => {
    if (genre === '__ADD_NEW__') {
      setShowAddGenreDialog(true);
      return;
    }
    if (!selectedGenres.includes(genre)) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleConfirmAddGenre = () => {
    const trimmedGenre = newGenreInput.trim();
    if (trimmedGenre) {
      onAddCustomGenre(trimmedGenre);
      setSelectedGenres([...selectedGenres, trimmedGenre]);
      setNewGenreInput('');
      setShowAddGenreDialog(false);
    }
  };

  const handleRemoveGenre = (genre: Genre) => {
    setSelectedGenres(selectedGenres.filter(g => g !== genre));
  };

  const handleMediaTypeChange = (value: string) => {
    if (value === '__ADD_NEW__') {
      setShowAddMediaTypeDialog(true);
      return;
    }
    setType(value);
  };

  const handleConfirmAddMediaType = () => {
    const trimmedType = newMediaTypeInput.trim();
    if (trimmedType) {
      onAddCustomMediaType(trimmedType);
      setType(trimmedType);
      setNewMediaTypeInput('');
      setShowAddMediaTypeDialog(false);
    }
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

  const handleSubmit = () => {
    const newMedia = {
      id: `media-${Date.now()}`,
      title,
      type,
      genre: selectedGenres,
      status,
      imageUrl: imageUpload || undefined,
      rating: rating > 0 ? rating : undefined,
      dateAdded: new Date().toISOString().split('T')[0],
      dateStarted: dateStarted || undefined,
      dateCompleted: dateCompleted || undefined,
      notes,
    };
    
    onAdd(newMedia, selectedBoards);
    
    // Reset form
    setTitle('');
    setType('movie');
    setStatus('want-to-watch');
    setSelectedGenres([]);
    setImageUpload('');
    setRating(0);
    setNotes('');
    setSelectedBoards([]);
    setBoardSearchQuery('');
    setCustomGenreInput('');
    setDateStarted('');
    setDateCompleted('');
    setOpen(false);
  };

  const filteredBoards = useMemo(() => {
    const availableBoards = boards.filter(board => board.name !== 'All');
    if (!boardSearchQuery) return availableBoards;
    return availableBoards.filter(board =>
      board.name.toLowerCase().includes(boardSearchQuery.toLowerCase())
    );
  }, [boards, boardSearchQuery]);

  const allGenres = useMemo(() => {
    return [...defaultGenres, ...customGenres];
  }, [customGenres]);

  const allMediaTypes = useMemo(() => {
    return [...defaultMediaTypes, ...customMediaTypes];
  }, [customMediaTypes]);

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Media Type *</Label>
              <Select value={type} onValueChange={handleMediaTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ADD_NEW__" className="text-primary">
                    + Add New Media Type
                  </SelectItem>
                  {allMediaTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === 'tv' ? 'TV Show' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as WatchStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {watchStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genres</Label>
            <Select onValueChange={(value) => handleAddGenre(value as Genre)}>
              <SelectTrigger>
                <SelectValue placeholder="Select genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ADD_NEW__" className="text-primary">
                  + Add New Genre
                </SelectItem>
                {allGenres.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedGenres.map((genre) => (
                <Badge key={genre} variant="secondary" className="gap-1">
                  {genre}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => handleRemoveGenre(genre)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-started">Start Date (Optional)</Label>
              <Input
                id="date-started"
                type="date"
                value={dateStarted}
                onChange={(e) => setDateStarted(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-completed">Completed Date (Optional)</Label>
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
            <Label>Add to Boards</Label>
            <Popover open={boardSearchOpen} onOpenChange={setBoardSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedBoards.length > 0
                    ? `${selectedBoards.length} board${selectedBoards.length > 1 ? 's' : ''} selected`
                    : "Select boards..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search boards..." 
                    value={boardSearchQuery}
                    onValueChange={setBoardSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No boards found.</CommandEmpty>
                    <CommandGroup>
                      {filteredBoards.map((board) => {
                        const isSelected = selectedBoards.includes(board.id);
                        return (
                          <CommandItem
                            key={board.id}
                            onSelect={() => {
                              setSelectedBoards(
                                isSelected
                                  ? selectedBoards.filter((id) => id !== board.id)
                                  : [...selectedBoards, board.id]
                              );
                            }}
                          >
                            {isSelected ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 fill-primary text-primary" />
                            ) : (
                              <Circle className="mr-2 h-4 w-4 text-muted-foreground" />
                            )}
                            {board.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedBoards.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedBoards.map((boardId) => {
                  const board = boards.find((b) => b.id === boardId);
                  return board ? (
                    <Badge key={board.id} variant="secondary" className="gap-1">
                      {board.name}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setSelectedBoards(selectedBoards.filter((id) => id !== boardId))
                        }
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
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
          <Button onClick={handleSubmit} disabled={!title}>
            Add Media
          </Button>
        </div>
      </DialogContent>

      {/* Add New Genre Dialog */}
      <AlertDialog open={showAddGenreDialog} onOpenChange={setShowAddGenreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Genre</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your custom genre. This will be available for all future media items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Genre name"
            value={newGenreInput}
            onChange={(e) => setNewGenreInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmAddGenre();
              }
            }}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewGenreInput('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAddGenre} disabled={!newGenreInput.trim()}>
              Add Genre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add New Media Type Dialog */}
      <AlertDialog open={showAddMediaTypeDialog} onOpenChange={setShowAddMediaTypeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Media Type</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your custom media type.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Media type name"
            value={newMediaTypeInput}
            onChange={(e) => setNewMediaTypeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmAddMediaType();
              }
            }}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewMediaTypeInput('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAddMediaType} disabled={!newMediaTypeInput.trim()}>
              Add Media Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
