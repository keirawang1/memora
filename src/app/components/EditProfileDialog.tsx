import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { UserAvatar } from './UserAvatar';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { fileToAvatarDataUrl } from '../utils/resizeImage';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  bio: string;
  avatar?: string;
  accentColor?: string;
  onSave: (data: { displayName: string; bio: string; avatar?: string }) => void | Promise<void>;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  displayName,
  bio,
  avatar,
  accentColor,
  onSave,
}: EditProfileDialogProps) {
  const [editDisplayName, setEditDisplayName] = useState(displayName);
  const [editBio, setEditBio] = useState(bio);
  const [editAvatar, setEditAvatar] = useState(avatar);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEditDisplayName(displayName);
      setEditBio(bio);
      setEditAvatar(avatar);
    }
  }, [open, displayName, bio, avatar]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        displayName: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setEditAvatar(dataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image';
      toast.error(message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Edit your profile information including avatar, username, display name, and bio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-4">
            <Label>Avatar</Label>
            <div className="flex flex-col items-center gap-4">
              <UserAvatar
                displayName={editDisplayName}
                avatar={editAvatar}
                size="xl"
                accentColor={accentColor}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUploadClick}
                disabled={saving || uploadingAvatar}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadingAvatar ? 'Processing...' : 'Upload Avatar'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="Enter display name"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              disabled={saving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
