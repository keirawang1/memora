import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { MediaTypeSelectDropdown } from './MediaTypeSelectDropdown';
import { CoverImageUpload } from './CoverImageUpload';
import type { CreateBoardInput } from '../supabase/boards';
import { BOARD_TYPE_MIXED, getBoardMediaTypeOptions } from '../data/mediaOptions';
import { accentButtonStyle } from '../utils/accentColor';

interface AddBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateBoardInput) => Promise<void>;
  customMediaTypes: string[];
}

export function AddBoardDialog({
  open,
  onOpenChange,
  onAdd,
  customMediaTypes,
}: AddBoardDialogProps) {
  const [title, setTitle] = useState('');
  const [boardType, setBoardType] = useState<string>(BOARD_TYPE_MIXED);
  const [imageUpload, setImageUpload] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mediaTypeOptions = useMemo(
    () => getBoardMediaTypeOptions(customMediaTypes),
    [customMediaTypes],
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onAdd({
        name: title,
        description,
        type: boardType,
        isPublic,
        coverImageDataUrl: imageUpload || undefined,
      });

      setTitle('');
      setBoardType(BOARD_TYPE_MIXED);
      setImageUpload('');
      setDescription('');
      setIsPublic(false);
      onOpenChange(false);
    } catch {
      // Error toast handled in App.handleAddBoard
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new board to organize your media collection
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Board Name *</Label>
            <Input
              id="title"
              placeholder="Name your board"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <CoverImageUpload
            label="Board Cover Image"
            inputId="board-image-upload"
            value={imageUpload}
            onChange={setImageUpload}
          />

          <div className="space-y-2">
            <Label htmlFor="board-type">Media Type</Label>
            <MediaTypeSelectDropdown
              id="board-type"
              options={mediaTypeOptions}
              value={boardType}
              onChange={setBoardType}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this board..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="h-20"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="board-public">Public Board</Label>
              <div className="text-sm text-muted-foreground">
                Allow others to see this board
              </div>
            </div>
            <Switch
              id="board-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSubmit} style={accentButtonStyle} disabled={!title || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Board'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
