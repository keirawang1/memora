import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Palette, User, Tags, Film, LayoutGrid } from 'lucide-react';
import { Switch } from './ui/switch';
import { ManageTagsDialog } from './ManageTagsDialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  username?: string;
  onSaveAccountSettings?: (data: { username: string }) => void;
  customGenres: string[];
  customMediaTypes: string[];
  onSaveCustomGenres: (genres: string[]) => Promise<void>;
  onSaveCustomMediaTypes: (mediaTypes: string[]) => Promise<void>;
  showAllBoard: boolean;
  onShowAllBoardChange: (show: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  accentColor,
  onAccentColorChange,
  username = '',
  onSaveAccountSettings,
  customGenres,
  customMediaTypes,
  onSaveCustomGenres,
  onSaveCustomMediaTypes,
  showAllBoard,
  onShowAllBoardChange,
}: SettingsDialogProps) {
  const [editUsername, setEditUsername] = useState(username);
  const [usernameError, setUsernameError] = useState('');
  const [manageGenresOpen, setManageGenresOpen] = useState(false);
  const [manageMediaTypesOpen, setManageMediaTypesOpen] = useState(false);

  const validateUsername = (value: string) => {
    const cleanValue = value.replace('@', '');
    if (cleanValue.length === 0) {
      setUsernameError('Username is required');
      return false;
    }
    if (cleanValue.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanValue)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handleUsernameChange = (value: string) => {
    const cleanValue = value.replace('@', '');
    setEditUsername(cleanValue);
    validateUsername(cleanValue);
  };

  const handleSaveAccountSettings = () => {
    if (validateUsername(editUsername) && onSaveAccountSettings) {
      onSaveAccountSettings({
        username: editUsername,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Customize your Memora experience
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <Label>Accent Color</Label>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="accentColor" className="text-sm text-muted-foreground mb-2 block">
                    Choose your accent color
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="accentColor"
                      type="color"
                      value={accentColor}
                      onChange={(e) => onAccentColorChange(e.target.value)}
                      className="h-12 w-20 rounded border border-input cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={accentColor}
                      onChange={(e) => onAccentColorChange(e.target.value)}
                      placeholder="#5C2B17"
                      className="flex-1"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <Label>Library</Label>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-3">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="show-all-board">Show All board</Label>
                  <p className="text-xs text-muted-foreground">
                    Displays your full library as the first board. All media is added here automatically.
                  </p>
                </div>
                <Switch
                  id="show-all-board"
                  checked={showAllBoard}
                  onCheckedChange={onShowAllBoardChange}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4" />
                <Label>Library tags</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Custom options appear in Add and Edit Media dropdowns.
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setManageGenresOpen(true)}
              >
                <Tags className="w-4 h-4 mr-2" />
                Manage custom genres
                {customGenres.length > 0 && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    {customGenres.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setManageMediaTypesOpen(true)}
              >
                <Film className="w-4 h-4 mr-2" />
                Manage custom media types
                {customMediaTypes.length > 0 && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    {customMediaTypes.length}
                  </span>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <Label>Account</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={editUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="username"
                />
                {usernameError && (
                  <p className="text-xs text-red-500">{usernameError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Max 20 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              {onSaveAccountSettings && (
                <Button
                  onClick={handleSaveAccountSettings}
                  className="w-full"
                  disabled={!!usernameError || !editUsername}
                >
                  Save Account Settings
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ManageTagsDialog
        open={manageGenresOpen}
        onOpenChange={setManageGenresOpen}
        title="Manage custom genres"
        description="Add, rename, or remove genres for your library. Built-in genres cannot be edited here."
        tags={customGenres}
        onSave={onSaveCustomGenres}
        addPlaceholder="Genre name"
      />

      <ManageTagsDialog
        open={manageMediaTypesOpen}
        onOpenChange={setManageMediaTypesOpen}
        title="Manage custom media types"
        description="Add, rename, or remove media types for your library. Built-in types cannot be edited here."
        tags={customMediaTypes}
        onSave={onSaveCustomMediaTypes}
        addPlaceholder="Media type name"
      />
    </>
  );
}
