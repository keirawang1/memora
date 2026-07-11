import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
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
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Calendar, Tag, Trash2, Save, Pencil, X, Upload, ExternalLink } from 'lucide-react';
import { StarRating, formatRating } from './StarRating';
import type { MediaItem, MediaType, WatchStatus, Genre, Board } from '../types/media';
import { BoardMultiSelect } from './BoardMultiSelect';
import { GenreSelectDropdown } from './GenreSelectDropdown';
import {
  DEFAULT_GENRES,
  DEFAULT_MEDIA_TYPES,
  formatMediaTypeLabel,
  getMediaBoardIds,
} from '../data/mediaOptions';

interface MediaDetailDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: Board[];
  onUpdateNotes?: (mediaId: string, notes: string) => void;
  onUpdateMedia?: (
    mediaId: string,
    updates: Partial<MediaItem>,
    boardIds?: string[],
  ) => void;
  onDelete?: (mediaId: string) => void;
  customGenres: string[];
  customMediaTypes: string[];
  readOnly?: boolean;
}

const watchStatuses: WatchStatus[] = ['completed', 'in-progress', 'not-started', 'dropped'];

export function MediaDetailDialog({
  media,
  open,
  onOpenChange,
  boards,
  onUpdateNotes,
  onUpdateMedia,
  onDelete,
  customGenres,
  customMediaTypes,
  readOnly = false,
}: MediaDetailDialogProps) {
  const [notes, setNotes] = useState(media?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [previewGalleryImage, setPreviewGalleryImage] = useState<string | null>(null);
  const [galleryRemoveIndex, setGalleryRemoveIndex] = useState<number | null>(null);
  const [deleteMediaDialogOpen, setDeleteMediaDialogOpen] = useState(false);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<MediaType>('movie');
  const [editStatus, setEditStatus] = useState<WatchStatus>('not-started');
  const [editGenres, setEditGenres] = useState<Genre[]>([]);
  const [editRating, setEditRating] = useState(0);
  const [editImageUpload, setEditImageUpload] = useState('');
  const [editDateStarted, setEditDateStarted] = useState('');
  const [editDateCompleted, setEditDateCompleted] = useState('');
  const [editSelectedBoards, setEditSelectedBoards] = useState<string[]>([]);
  const [editLink, setEditLink] = useState('');

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
      setEditSelectedBoards(getMediaBoardIds(media.id, boards));
      setEditLink(media.link || '');
    }
  }, [media, boards]);

  // Reset edit mode when dialog opens or media changes
  useEffect(() => {
    if (open) {
      setIsEditingMedia(false);
      setIsEditingNotes(false);
    } else {
      setPreviewGalleryImage(null);
      setGalleryRemoveIndex(null);
      setDeleteMediaDialogOpen(false);
    }
  }, [open, media]);

  const allGenres = useMemo(
    () => [...DEFAULT_GENRES, ...customGenres],
    [customGenres],
  );

  const allMediaTypes = useMemo(
    () => [...DEFAULT_MEDIA_TYPES, ...customMediaTypes],
    [customMediaTypes],
  );

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

  const handleRemoveGenre = (genre: Genre) => {
    setEditGenres(editGenres.filter((g) => g !== genre));
  };

  const handleSaveEdit = () => {
    if (!media) return;
    onUpdateMedia?.(
      media.id,
      {
        title: editTitle,
        type: editType,
        status: editStatus,
        genre: editGenres,
        rating: editRating > 0 ? editRating : undefined,
        imageUrl: editImageUpload || media.imageUrl,
        dateStarted: editDateStarted || undefined,
        dateCompleted: editDateCompleted || undefined,
        link: editLink.trim() || undefined,
      },
      editSelectedBoards,
    );

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
    setEditSelectedBoards(getMediaBoardIds(media.id, boards));
    setEditLink(media.link || '');
    setIsEditingMedia(false);
  };

  const handleDeleteMedia = () => {
    if (!media) return;
    onDelete?.(media.id);
    setDeleteMediaDialogOpen(false);
    onOpenChange(false);
  };

  const statusColors = {
    'completed': 'bg-green-500',
    'in-progress': 'bg-blue-500',
    'not-started': 'bg-yellow-500',
    'dropped': 'bg-red-500',
  };

  const statusLabels = {
    'completed': 'Completed',
    'in-progress': 'In Progress',
    'not-started': 'Not Started',
    'dropped': 'Dropped',
  };

  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className={isEditingMedia ? undefined : 'text-2xl'}>
            {isEditingMedia ? 'Edit Media' : media.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditingMedia ? 'Edit media details including title, type, status, genres, rating, and image' : 'View and manage media details'}
          </DialogDescription>
        </DialogHeader>

        {isEditingMedia ? (
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <BoardMultiSelect
              boards={boards}
              selectedBoardIds={editSelectedBoards}
              onChange={setEditSelectedBoards}
              label="Boards"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Media Type *</Label>
                <Select value={editType} onValueChange={(value) => setEditType(value)}>
                  <SelectTrigger id="edit-type">
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
              <GenreSelectDropdown
                genres={allGenres}
                selectedGenres={editGenres}
                onChange={setEditGenres}
              />
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

            <div className="space-y-2">
              <Label htmlFor="edit-link">Link</Label>
              <Input
                id="edit-link"
                type="url"
                placeholder="https://..."
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                className="text-sm"
              />
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
              <StarRating value={editRating} onChange={setEditRating} />
            </div>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => {
                  setIsEditingMedia(false);
                  setDeleteMediaDialogOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Media
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleCancelEdit} variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-sm">
                {media.type.toUpperCase()}
              </Badge>
              {media.rating != null && media.rating > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating value={media.rating} onChange={() => {}} readOnly size="sm" />
                  <span>{formatRating(media.rating)}/5</span>
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

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-2">
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
                {media.link && (
                  <div className="flex items-center gap-1">
                    <ExternalLink className="w-4 h-4" />
                    <a
                      href={media.link.match(/^https?:\/\//) ? media.link : `https://${media.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Link
                    </a>
                  </div>
                )}
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
                {!readOnly && !isEditingNotes && (
                  <Button
                    variant="accentGhost"
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
              {!readOnly && isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your thoughts..."
                    rows={4}
                    className="h-24"
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
                <div className="text-sm text-muted-foreground min-h-[60px] max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
                  {media.notes || (readOnly ? 'No notes' : 'No notes yet. Click edit to add your thoughts!')}
                </div>
              )}
            </div>

            {(gallery.length > 0 || !readOnly) && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm">Gallery</h3>
                {!readOnly && (
                  <>
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
                  </>
                )}
              </div>
              {gallery.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {gallery.map((image, index) => (
                      <div key={index} className="relative group">
                        <button
                          type="button"
                          onClick={() => setPreviewGalleryImage(image)}
                          className="block w-24 h-24 rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img
                            src={image}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setGalleryRemoveIndex(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Dialog
                    open={previewGalleryImage !== null}
                    onOpenChange={(open) => !open && setPreviewGalleryImage(null)}
                  >
                    <DialogContent
                      showCloseButton={false}
                      className="max-w-3xl p-2 sm:p-4 cursor-pointer"
                      onClick={() => setPreviewGalleryImage(null)}
                    >
                      {previewGalleryImage && (
                        <img
                          src={previewGalleryImage}
                          alt="Gallery preview"
                          className="w-full max-h-[80vh] object-contain rounded-md"
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <AlertDialog
                    open={galleryRemoveIndex !== null}
                    onOpenChange={(open) => {
                      if (!open) setGalleryRemoveIndex(null);
                    }}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove image?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This image will be removed from the gallery. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (galleryRemoveIndex !== null) {
                              handleRemoveGalleryImage(galleryRemoveIndex);
                              setGalleryRemoveIndex(null);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                  No images yet. Click "Add Images" to upload photos.
                </div>
              )}
            </div>
            )}

            </div>

            {!readOnly && (
            <div className="pt-4 border-t shrink-0">
              <Button
                variant="accent"
                onClick={() => {
                  if (media) {
                    setEditSelectedBoards(getMediaBoardIds(media.id, boards));
                  }
                  setIsEditingMedia(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Media
              </Button>
            </div>
            )}
          </>
        )}
      </DialogContent>

      <AlertDialog open={deleteMediaDialogOpen} onOpenChange={setDeleteMediaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{media.title}" from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMedia}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Media
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
