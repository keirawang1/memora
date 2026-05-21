import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Palette, User } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  username?: string;
  onSaveAccountSettings?: (data: { username: string }) => void;
}

export function SettingsDialog({ 
  open, 
  onOpenChange, 
  accentColor, 
  onAccentColorChange,
  username = '',
  onSaveAccountSettings
}: SettingsDialogProps) {
  const [editUsername, setEditUsername] = useState(username);
  const [usernameError, setUsernameError] = useState('');

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
  );
}
