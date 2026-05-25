import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Star, Calendar, Tag, Trash2, Save, Pencil, X, Upload } from 'lucide-react';
import type { MediaItem, MediaType, WatchStatus, Genre } from '../types/media';
import { ImageWithFallback } from './figma/ImageWithFallback';

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

interface MediaDetailDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateNotes?: (mediaId: string, notes: string) => void;
  onUpdateMedia?: (mediaId: string, updates: Partial<MediaItem>) => void;
  onDelete?: (mediaId: string) => void;
  customGenres: string[];
  customMediaTypes: string[];
  onAddCustomGenre: (genre: string) => void;
  onAddCustomMediaType: (type: string) => void;
}

const defaultMediaTypes: string[] = ['movie', 'tv', 'anime', 'comic', 'book'];
const watchStatuses: WatchStatus[] = ['watched', 'watching', 'want-to-watch', 'dropped'];
const defaultGenres: string[] = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Fantasy', 'Horror', 'Romance', 'Thriller', 'Documentary', 'Animation'];

export function MediaDetailDialog({ 
  media, 
  open, 
  onOpenChange,
  onUpdateNotes,
  onUpdateMedia,
  onDelete,
  customGenres,
  customMediaTypes,
  onAddCustomGenre,
  onAddCustomMediaType
}: MediaDetailDialogProps) {
  const [notes, setNotes] = useState(media?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<MediaType>('movie');
  const [editStatus, setEditStatus] = useState<WatchStatus>('want-to-watch');
  const [editGenres, setEditGenres] = useState<Genre[]>([]);
  const [editRating, setEditRating] = useState(0);
  const [editImageUpload, setEditImageUpload] = useState('');
  const [editDateStarted, setEditDateStarted] = useState('');
  const [editDateCompleted, setEditDateCompleted] = useState('');
  const [showAddGenreDialog, setShowAddGenreDialog] = useState(false);
  const [showAddMediaTypeDialog, setShowAddMediaTypeDialog] = useState(false);
  const [newGenreInput, setNewGenreInput] = useState('');
  const [newMediaTypeInput, setNewMediaTypeInput] = useState('');

  useEffect(() => {
    if (media) {
      setNotes(media.notes || '');
      setGallery(media.gallery || []);
      setEditTitle(media.title);
      setEditType(media.type);
      setEditStatus(media.status);
      setEditGenres(media.genre);
      setEditRating(media.rating || 0);
      setEditImageUpload('');
      setEditDateStarted(media.dateStarted || '');
      setEditDateCompleted(media.dateCompleted || '');
    }
  }, [media]);

  // Reset edit mode when dialog opens or media changes
  useEffect(() => {
    if (open) {
      setIsEditingMedia(false);
      setIsEditingNotes(false);
    }
  }, [open, media]);

  const allGenres = useMemo(() => {
    return [...defaultGenres, ...customGenres];
  }, [customGenres]);

  const allMediaTypes = useMemo(() => {
    return [...defaultMediaTypes, ...customMediaTypes];
  }, [customMediaTypes]);

  const handleSaveNotes = () => {
    if (!media) return;
    onUpdateNotes?.(media.id, notes);
    setIsEditingNotes(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImage = reader.result as string;
          setGallery(prev => [...prev, newImage]);
          // Update media immediately
          if (media) {
            onUpdateMedia?.(media.id, {
              gallery: [...gallery, newImage]
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    const newGallery = gallery.filter((_, i) => i !== index);
    setGallery(newGallery);
    // Update media immediately
    if (media) {
      onUpdateMedia?.(media.id, {
        gallery: newGallery
      });
    }
  };

  const handleAddGenre = (genre: Genre) => {
    if (genre === '__ADD_NEW__') {
      setShowAddGenreDialog(true);
      return;
    }
    if (!editGenres.includes(genre)) {
      setEditGenres([...editGenres, genre]);
    }
  };

  const handleConfirmAddGenre = () => {
    const trimmedGenre = newGenreInput.trim();
    if (trimmedGenre) {
      onAddCustomGenre(trimmedGenre);
      setEditGenres([...editGenres, trimmedGenre]);
      setNewGenreInput('');
      setShowAddGenreDialog(false);
    }
  };

  const handleRemoveGenre = (genre: Genre) => {
    setEditGenres(editGenres.filter(g => g !== genre));
  };

  const handleMediaTypeChange = (value: string) => {
    if (value === '__ADD_NEW__') {
      setShowAddMediaTypeDialog(true);
      return;
    }
    setEditType(value);
  };

  const handleConfirmAddMediaType = () => {
    const trimmedType = newMediaTypeInput.trim();
    if (trimmedType) {
      onAddCustomMediaType(trimmedType);
      setEditType(trimmedType);
      setNewMediaTypeInput('');
      setShowAddMediaTypeDialog(false);
    }
  };

  const handleSaveEdit = () => {
    if (!media) return;
    onUpdateMedia?.(media.id, {
      title: editTitle,
      type: editType,
      status: editStatus,
      genre: editGenres,
      rating: editRating > 0 ? editRating : undefined,
      imageUrl: editImageUpload || media.imageUrl,
      dateStarted: editDateStarted || undefined,
      dateCompleted: editDateCompleted || undefined,
    });
    
    setIsEditingMedia(false);
  };

  const handleCancelEdit = () => {
    if (!media) return;
    setEditTitle(media.title);
    setEditType(media.type);
    setEditStatus(media.status);
    setEditGenres(media.genre);
    setEditRating(media.rating || 0);
    setEditImageUpload('');
    setEditDateStarted(media.dateStarted || '');
    setEditDateCompleted(media.dateCompleted || '');
    setIsEditingMedia(false);
  };

  const statusColors = {
    'watched': 'bg-green-500',
    'watching': 'bg-blue-500',
    'want-to-watch': 'bg-yellow-500',
    'dropped': 'bg-red-500',
  };

  const statusLabels = {
    'watched': 'Completed',
    'watching': 'In Progress',
    'want-to-watch': 'Want to Watch',
    'dropped': 'Dropped',
  };

  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isEditingMedia ? 'Edit Media' : media.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditingMedia ? 'Edit media details including title, type, status, genres, rating, and image' : 'View and manage media details'}
          </DialogDescription>
        </DialogHeader>

        {isEditingMedia ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Media Type *</Label>
                <Select value={editType} onValueChange={handleMediaTypeChange}>
                  <SelectTrigger id="edit-type">
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
                <Label htmlFor="edit-status">Status *</Label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as WatchStatus)}>
                  <SelectTrigger id="edit-status">
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
                {editGenres.map((genre) => (
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
                <Label htmlFor="edit-date-started">Start Date</Label>
                <Input
                  id="edit-date-started"
                  type="date"
                  value={editDateStarted}
                  onChange={(e) => setEditDateStarted(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-date-completed">Completed Date</Label>
                <Input
                  id="edit-date-completed"
                  type="date"
                  value={editDateCompleted}
                  onChange={(e) => setEditDateCompleted(e.target.value)}
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
                  id="edit-image-upload"
                />
                <label htmlFor="edit-image-upload" className="cursor-pointer block">
                  {editImageUpload ? (
                    <div>
                      <img 
                        src={editImageUpload} 
                        alt="Preview" 
                        className="max-h-32 mx-auto rounded mb-2"
                      />
                      <p className="text-sm text-muted-foreground">Click to change image</p>
                    </div>
                  ) : (
                    <div>
                      <img 
                        src={media.imageUrl} 
                        alt="Current" 
                        className="max-h-32 mx-auto rounded mb-2"
                      />
                      <p className="text-sm text-muted-foreground">Click to change image</p>
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
                    onClick={() => setEditRating(star === editRating ? 0 : star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= editRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleCancelEdit} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-sm">
                {media.type.toUpperCase()}
              </Badge>
              {media.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span>{media.rating}/5</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={`${statusColors[media.status]} text-white border-0`}>
                  {statusLabels[media.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span>Genres:</span>
                <div className="flex flex-wrap gap-1">
                  {media.genre.map((g) => (
                    <Badge key={g} variant="secondary" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Added: {new Date(media.dateAdded).toLocaleDateString()}</span>
              </div>

              {media.dateStarted && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Started: {new Date(media.dateStarted).toLocaleDateString()}</span>
                </div>
              )}

              {media.dateCompleted && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Completed: {new Date(media.dateCompleted).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm">Notes</h3>
                {!isEditingNotes && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setNotes(media.notes || '');
                      setIsEditingNotes(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your thoughts..."
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes}>
                      <Save className="w-3 h-3 mr-2" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setNotes(media.notes || '');
                        setIsEditingNotes(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground min-h-[60px]">
                  {media.notes || 'No notes yet. Click edit to add your thoughts!'}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm">Gallery</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('gallery-upload')?.click()}
                >
                  <Upload className="w-3 h-3 mr-2" />
                  Add Images
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryImageUpload}
                  className="hidden"
                  id="gallery-upload"
                />
              </div>
              {gallery.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {gallery.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="w-24 h-24 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveGalleryImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                  No images yet. Click "Add Images" to upload photos.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsEditingMedia(true)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Media
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 text-red-600 hover:text-red-700"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this item?')) {
                    onDelete?.(media.id);
                    onOpenChange(false);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Add New Genre Dialog */}
      <AlertDialog open={showAddGenreDialog} onOpenChange={setShowAddGenreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Genre</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your custom genre.
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
