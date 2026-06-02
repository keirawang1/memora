import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Upload } from 'lucide-react';
import { Switch } from './ui/switch';

interface AddBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (board: any) => void;
}

export function AddBoardDialog({ open, onOpenChange, onAdd }: AddBoardDialogProps) {
  const [title, setTitle] = useState('');
  const [imageUpload, setImageUpload] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

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
    const newBoard = {
      id: `board-${Date.now()}`,
      name: title,
      mediaIds: [],
      isPublic,
      coverImage: imageUpload || '',
      createdAt: new Date().toISOString().split('T')[0],
      description,
    };
    
    onAdd(newBoard);
    
    // Reset form
    setTitle('');
    setImageUpload('');
    setDescription('');
    setIsPublic(false);
    onOpenChange(false);
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

          <div className="space-y-2">
            <Label>Board Cover Image</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="board-image-upload"
              />
              <label htmlFor="board-image-upload" className="cursor-pointer block">
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this board..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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
          <Button onClick={handleSubmit} disabled={!title}>
            Create Board
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
