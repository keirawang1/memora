import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Palette,
  User,
  Tags,
  Film,
  LayoutGrid,
  ChevronRight,
  ArrowLeft,
  Upload,
  Trash2,
} from 'lucide-react';
import { Switch } from './ui/switch';
import { ManageTagsDialog } from './ManageTagsDialog';
import { UserAvatar } from './UserAvatar';
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
import { toast } from 'sonner';
import { fileToAvatarDataUrl } from '../utils/resizeImage';
import { cn } from './ui/utils';
import { isValidAccentHex } from '../utils/accentColor';
import {
  DARK_THEME_ACCENT,
  DARK_THEME_BACKGROUND,
  LIGHT_THEME_BACKGROUND,
  type AppThemeMode,
  type AppThemeSettings,
} from '../utils/appTheme';
import { DEFAULT_ACCENT_COLOR } from '../data/defaults';

type SettingsPage = 'menu' | 'theme' | 'library' | 'account';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, opens directly to this page each time the dialog opens. */
  initialPage?: SettingsPage;
  accentColor: string;
  themeSettings: AppThemeSettings;
  onThemePreview?: (settings: AppThemeSettings) => void;
  onSaveTheme?: (settings: AppThemeSettings) => Promise<void>;
  email?: string;
  username?: string;
  avatar?: string;
  displayName?: string;
  onSaveAccountSettings?: (data: {
    username: string;
    email: string;
    avatar?: string;
  }) => Promise<void>;
  onChangePassword?: (password: string) => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
  customGenres: string[];
  customMediaTypes: string[];
  onSaveCustomGenres: (genres: string[]) => Promise<void>;
  onSaveCustomMediaTypes: (mediaTypes: string[]) => Promise<void>;
  showAllBoard: boolean;
  publicBoardsFriendsOnly: boolean;
  onSaveLibrarySettings?: (data: {
    showAllBoard: boolean;
    publicBoardsFriendsOnly: boolean;
  }) => Promise<void>;
  usedCustomGenres?: string[];
  usedCustomMediaTypes?: string[];
}

function SettingsMenuItem({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Palette;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-md border px-3 py-3 text-left hover:bg-muted/50 transition-colors"
    >
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

const THEME_OPTIONS: {
  mode: AppThemeMode;
  label: string;
  previewBg: string;
  previewAccent: string;
}[] = [
  {
    mode: 'light',
    label: 'Light',
    previewBg: LIGHT_THEME_BACKGROUND,
    previewAccent: DEFAULT_ACCENT_COLOR,
  },
  {
    mode: 'dark',
    label: 'Dark',
    previewBg: DARK_THEME_BACKGROUND,
    previewAccent: DARK_THEME_ACCENT,
  },
  {
    mode: 'custom',
    label: 'Custom',
    previewBg: LIGHT_THEME_BACKGROUND,
    previewAccent: DEFAULT_ACCENT_COLOR,
  },
];

function ThemeOption({
  label,
  previewBg,
  previewAccent,
  selected,
  onClick,
}: {
  label: string;
  previewBg: string;
  previewAccent: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors',
        selected ? 'border-primary ring-2 ring-ring' : 'hover:bg-muted/50',
      )}
    >
      <div
        className="size-10 shrink-0 rounded-md border flex items-center justify-center"
        style={{ backgroundColor: previewBg }}
      >
        <div
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: previewAccent }}
        />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </button>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialPage,
  accentColor,
  themeSettings,
  onThemePreview,
  onSaveTheme,
  email = '',
  username = '',
  avatar,
  displayName = '',
  onSaveAccountSettings,
  onChangePassword,
  onDeleteAccount,
  customGenres,
  customMediaTypes,
  onSaveCustomGenres,
  onSaveCustomMediaTypes,
  showAllBoard,
  publicBoardsFriendsOnly,
  onSaveLibrarySettings,
  usedCustomGenres = [],
  usedCustomMediaTypes = [],
}: SettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>(initialPage ?? 'menu');
  const [draftTheme, setDraftTheme] = useState<AppThemeSettings>(themeSettings);
  const [draftShowAllBoard, setDraftShowAllBoard] = useState(showAllBoard);
  const [draftPublicBoardsFriendsOnly, setDraftPublicBoardsFriendsOnly] = useState(
    publicBoardsFriendsOnly,
  );
  const [editUsername, setEditUsername] = useState(username);
  const [editEmail, setEditEmail] = useState(email);
  const [editAvatar, setEditAvatar] = useState(avatar);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [manageGenresOpen, setManageGenresOpen] = useState(false);
  const [manageMediaTypesOpen, setManageMediaTypesOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPage(initialPage ?? 'menu');
      return;
    }
    setPage('menu');
    onThemePreview?.(themeSettings);
  }, [open, initialPage, themeSettings, onThemePreview]);

  useEffect(() => {
    if (page === 'theme') {
      setDraftTheme(themeSettings);
    }
  }, [page, themeSettings]);

  useEffect(() => {
    if (page === 'library') {
      setDraftShowAllBoard(showAllBoard);
      setDraftPublicBoardsFriendsOnly(publicBoardsFriendsOnly);
    }
  }, [page, showAllBoard, publicBoardsFriendsOnly]);

  useEffect(() => {
    if (page === 'account') {
      setEditUsername(username);
      setEditEmail(email);
      setEditAvatar(avatar);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setUsernameError('');
      setEmailError('');
    }
  }, [page, username, email, avatar]);

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

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleUsernameChange = (value: string) => {
    const cleanValue = value.replace('@', '');
    setEditUsername(cleanValue);
    validateUsername(cleanValue);
  };

  const handleEmailChange = (value: string) => {
    setEditEmail(value);
    validateEmail(value);
  };

  const previewTheme = (next: AppThemeSettings) => {
    setDraftTheme(next);
    onThemePreview?.(next);
  };

  const handleThemeModeSelect = (mode: AppThemeMode) => {
    previewTheme({ ...draftTheme, mode });
  };

  const handleDraftBackgroundChange = (color: string) => {
    previewTheme({ ...draftTheme, backgroundColor: color });
  };

  const handleDraftCustomAccentChange = (color: string) => {
    previewTheme({ ...draftTheme, customAccentColor: color });
  };

  const handleBack = () => {
    if (page === 'theme') {
      onThemePreview?.(themeSettings);
      setDraftTheme(themeSettings);
    }
    if (page === 'library') {
      setDraftShowAllBoard(showAllBoard);
      setDraftPublicBoardsFriendsOnly(publicBoardsFriendsOnly);
    }
    setPage('menu');
  };

  const handleSaveTheme = async () => {
    if (!onSaveTheme) return;
    if (
      draftTheme.mode === 'custom' &&
      (!isValidAccentHex(draftTheme.customAccentColor) ||
        !isValidAccentHex(draftTheme.backgroundColor))
    ) {
      return;
    }
    setSavingTheme(true);
    try {
      await onSaveTheme(draftTheme);
      setPage('menu');
    } finally {
      setSavingTheme(false);
    }
  };

  const customThemeValid =
    isValidAccentHex(draftTheme.customAccentColor) &&
    isValidAccentHex(draftTheme.backgroundColor);

  const handleSaveLibrary = async () => {
    if (!onSaveLibrarySettings) return;
    setSavingLibrary(true);
    try {
      await onSaveLibrarySettings({
        showAllBoard: draftShowAllBoard,
        publicBoardsFriendsOnly: draftPublicBoardsFriendsOnly,
      });
      setPage('menu');
    } finally {
      setSavingLibrary(false);
    }
  };

  const handleSaveAccount = async () => {
    const usernameValid = validateUsername(editUsername);
    const emailValid = validateEmail(editEmail);
    if (!usernameValid || !emailValid || !onSaveAccountSettings) return;

    setSavingAccount(true);
    try {
      await onSaveAccountSettings({
        username: editUsername,
        email: editEmail.trim(),
        avatar: editAvatar,
      });
      setPage('menu');
    } finally {
      setSavingAccount(false);
    }
  };

  const validatePasswordChange = () => {
    if (!newPassword && !confirmPassword) {
      setPasswordError('');
      return false;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordChange() || !onChangePassword) return;

    setChangingPassword(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      toast.success('Password updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!onDeleteAccount) return;
    setDeletingAccount(true);
    try {
      await onDeleteAccount();
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } finally {
      setDeletingAccount(false);
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

  const pageTitle =
    page === 'theme'
      ? 'Theme'
      : page === 'library'
        ? 'Library'
        : page === 'account'
          ? 'Manage Account'
          : 'Settings';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            {page === 'menu' ? (
              <DialogTitle>{pageTitle}</DialogTitle>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleBack}
                  aria-label="Back to settings"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <DialogTitle>{pageTitle}</DialogTitle>
              </div>
            )}
          </DialogHeader>

          {page === 'menu' && (
            <div className="space-y-2 py-2">
              <SettingsMenuItem
                icon={Palette}
                label="Theme"
                description="Light, dark, or custom"
                onClick={() => setPage('theme')}
              />
              <SettingsMenuItem
                icon={LayoutGrid}
                label="Library"
                description="Boards and custom tags"
                onClick={() => setPage('library')}
              />
              <SettingsMenuItem
                icon={User}
                label="Manage Account"
                description="Email, username, profile"
                onClick={() => setPage('account')}
              />
            </div>
          )}

          {page === 'theme' && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="space-y-2">
                  {THEME_OPTIONS.map((option) => (
                    <ThemeOption
                      key={option.mode}
                      label={option.label}
                      previewBg={
                        option.mode === 'custom'
                          ? draftTheme.backgroundColor
                          : option.previewBg
                      }
                      previewAccent={
                        option.mode === 'custom'
                          ? draftTheme.customAccentColor
                          : option.previewAccent
                      }
                      selected={draftTheme.mode === option.mode}
                      onClick={() => handleThemeModeSelect(option.mode)}
                    />
                  ))}
                </div>
              </div>

              {draftTheme.mode === 'custom' && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">Background Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="backgroundColor"
                        type="color"
                        value={draftTheme.backgroundColor}
                        onChange={(e) => handleDraftBackgroundChange(e.target.value)}
                        className="h-10 w-16 rounded border border-input cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={draftTheme.backgroundColor}
                        onChange={(e) => handleDraftBackgroundChange(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="accentColor"
                        type="color"
                        value={draftTheme.customAccentColor}
                        onChange={(e) => handleDraftCustomAccentChange(e.target.value)}
                        className="h-10 w-16 rounded border border-input cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={draftTheme.customAccentColor}
                        onChange={(e) => handleDraftCustomAccentChange(e.target.value)}
                        placeholder="#5C2B17"
                        className="flex-1"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              )}

              {onSaveTheme && (
                <Button
                  onClick={() => void handleSaveTheme()}
                  className="w-full"
                  disabled={
                    savingTheme ||
                    (draftTheme.mode === 'custom' && !customThemeValid)
                  }
                >
                  {savingTheme ? 'Saving...' : 'Save Theme'}
                </Button>
              )}
            </div>
          )}

          {page === 'library' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-3">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="show-all-board">Show All board</Label>
                  <p className="text-xs text-muted-foreground">
                    All media is added here automatically.
                  </p>
                </div>
                <Switch
                  id="show-all-board"
                  checked={draftShowAllBoard}
                  onCheckedChange={setDraftShowAllBoard}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-3">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="public-boards-friends-only">
                    Public Boards: Friends Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When on, only friends can view your public boards.
                  </p>
                </div>
                <Switch
                  id="public-boards-friends-only"
                  checked={draftPublicBoardsFriendsOnly}
                  onCheckedChange={setDraftPublicBoardsFriendsOnly}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Custom options appear in Add and Edit Media dropdowns.
                </p>
                <Button
                  id="onboarding-custom-genres"
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

              {onSaveLibrarySettings && (
                <Button
                  onClick={() => void handleSaveLibrary()}
                  className="w-full"
                  disabled={savingLibrary}
                >
                  {savingLibrary ? 'Saving...' : 'Save Library Settings'}
                </Button>
              )}
            </div>
          )}

          {page === 'account' && (
            <div className="flex flex-col gap-3">
              <div className="max-h-[min(50vh,300px)] overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-3 py-1 pb-2">
                  <div className="space-y-2">
                    <Label>Avatar</Label>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        displayName={displayName || editUsername}
                        avatar={editAvatar}
                        size="sm"
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
                        className="flex-1"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={savingAccount || uploadingAvatar}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingAvatar ? 'Processing...' : 'Change Avatar'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                      <span className="pl-3 text-muted-foreground text-sm">@</span>
                      <Input
                        id="username"
                        value={editUsername}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="username"
                        className="border-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    {usernameError && (
                      <p className="text-xs text-red-500">{usernameError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Max 20 characters. Letters, numbers, and underscores only.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="you@example.com"
                    />
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordError) validatePasswordChange();
                      }}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordError) validatePasswordChange();
                      }}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />
                    {passwordError && (
                      <p className="text-xs text-red-500">{passwordError}</p>
                    )}
                  </div>

                  {onChangePassword && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleChangePassword()}
                      disabled={
                        changingPassword ||
                        !newPassword ||
                        !confirmPassword ||
                        savingAccount
                      }
                    >
                      {changingPassword ? 'Updating...' : 'Change Password'}
                    </Button>
                  )}

                  {onDeleteAccount && (
                    <div className="pt-6 mt-4 border-t">
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={savingAccount || deletingAccount}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {onSaveAccountSettings && (
                <Button
                  onClick={() => void handleSaveAccount()}
                  className="w-full shrink-0"
                  disabled={
                    savingAccount ||
                    !!usernameError ||
                    !!emailError ||
                    !editUsername ||
                    !editEmail
                  }
                >
                  {savingAccount ? 'Saving...' : 'Save Account'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ManageTagsDialog
        open={manageGenresOpen}
        onOpenChange={setManageGenresOpen}
        title="Manage custom genres"
        description="Add, rename, or remove genres for your library. Default genres cannot be edited."
        tags={customGenres}
        onSave={onSaveCustomGenres}
        addPlaceholder="Genre name"
        lockedTags={usedCustomGenres}
        lockedReason="This genre is used by media and cannot be deleted."
      />

      <ManageTagsDialog
        open={manageMediaTypesOpen}
        onOpenChange={setManageMediaTypesOpen}
        title="Manage custom media types"
        description="Add, rename, or remove media types for your library. Default types cannot be edited."
        tags={customMediaTypes}
        onSave={onSaveCustomMediaTypes}
        addPlaceholder="Media type name"
        lockedTags={usedCustomMediaTypes}
        lockedReason="This media type is used by a board or media and cannot be deleted."
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, library, boards, and posts. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteAccount();
              }}
              disabled={deletingAccount}
            >
              {deletingAccount ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
