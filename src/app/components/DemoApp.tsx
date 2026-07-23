import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LibraryPage } from './LibraryPage';
import { BoardDetailPage } from './BoardDetailPage';
import { FriendsPage } from './FriendsPage';
import { RecommendationsPage } from './RecommendationsPage';
import { AddMediaDialog } from './AddMediaDialog';
import { AddBoardDialog } from './AddBoardDialog';
import { MediaDetailDialog } from './MediaDetailDialog';
import { ProfilePage } from './ProfilePage';
import { UserAvatar } from './UserAvatar';
import { SettingsDialog } from './SettingsDialog';
import { OnboardingTour } from './OnboardingTour';
import { Button } from './ui/button';
import { DEFAULT_ACCENT_COLOR } from '../data/defaults';
import {
  filterBoardsForDisplay,
  getBoardMediaItems,
  isAllBoard,
  sortBoardsWithAllFirst,
  syncBoardMembershipsLocally,
} from '../data/allBoard';
import { mergeCustomOrder } from '../data/sortOrder';
import type { MediaItem, Friend, Board, User } from '../types/media';
import type { SortMode } from '../types/sort';
import { Library, User as UserIcon, Users, Sparkles, Settings, LogOut } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { BrandMark } from './BrandMark';
import type { CreateBoardInput } from '../supabase/boards';
import {
  applyAppTheme,
  createDefaultThemeSettings,
  type AppThemeSettings,
} from '../utils/appTheme';
import {
  APP_ROUTES,
  getBoardIdFromPath,
  getTabFromPath,
  isProfilePath,
  tabToRoute,
  type AppTab,
} from '../utils/appRoutes';
import {
  DEMO_MEDIA,
  DEMO_PREFERRED_GENRES,
  DEMO_PREFERRED_MEDIA_TYPES,
  DEMO_SEARCHABLE_USERS,
  DEMO_USER,
  createDemoBoards,
  createDemoFeedPosts,
  createDemoFriends,
} from '../data/demoData';

function demoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function demoPathToAppPath(pathname: string): string {
  if (pathname === APP_ROUTES.demo || pathname === `${APP_ROUTES.demo}/`) {
    return APP_ROUTES.library;
  }
  if (pathname.startsWith(`${APP_ROUTES.demo}/`)) {
    return pathname.slice(APP_ROUTES.demo.length) || APP_ROUTES.library;
  }
  return pathname;
}

function appPathToDemoPath(path: string): string {
  if (path === APP_ROUTES.library) return APP_ROUTES.demo;
  return `${APP_ROUTES.demo}${path}`;
}

export function DemoApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const appPath = demoPathToAppPath(location.pathname);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => [...DEMO_MEDIA]);
  const [boards, setBoards] = useState<Board[]>(() => createDemoBoards());
  const [friends, setFriends] = useState<Friend[]>(() => createDemoFriends());
  const [user, setUser] = useState<User>(() => ({ ...DEMO_USER }));
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [themeSettings, setThemeSettings] = useState<AppThemeSettings>(() =>
    createDefaultThemeSettings(),
  );
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [customMediaTypes, setCustomMediaTypes] = useState<string[]>([]);
  const [showAllBoard, setShowAllBoard] = useState(true);
  const [publicBoardsFriendsOnly, setPublicBoardsFriendsOnly] = useState(false);
  const [boardSortMode, setBoardSortMode] = useState<SortMode>('alphabetical');
  const [boardCustomOrder, setBoardCustomOrder] = useState<string[]>([]);
  const [mediaSortMode, setMediaSortMode] = useState<SortMode>('alphabetical');
  const [demoPosts] = useState(() => createDemoFeedPosts());
  const [showOnboardingTour, setShowOnboardingTour] = useState(true);
  const [addMediaDialogOpen, setAddMediaDialogOpen] = useState(false);

  const boardIdFromUrl = getBoardIdFromPath(appPath);
  const showProfile = isProfilePath(appPath);
  const activeTab: AppTab = getTabFromPath(appPath) ?? 'library';

  const selectedBoard = useMemo(() => {
    if (!boardIdFromUrl) return null;
    return boards.find((board) => board.id === boardIdFromUrl) ?? null;
  }, [boardIdFromUrl, boards]);

  const visibleBoards = useMemo(
    () => filterBoardsForDisplay(boards, showAllBoard),
    [boards, showAllBoard],
  );

  const go = (path: string) => navigate(appPathToDemoPath(path));

  const handleExitDemo = () => {
    navigate(APP_ROUTES.home);
    toast.info('Left demo — nothing was saved');
  };

  const handleAddMedia = async (
    newMedia: Omit<MediaItem, 'id' | 'dateAdded'> & { id?: string },
    boardIds?: string[],
  ) => {
    const id = newMedia.id ?? demoId('media');
    const created: MediaItem = {
      ...newMedia,
      id,
      dateAdded: new Date().toISOString().slice(0, 10),
      boardIds: boardIds ?? [],
    };
    const nextMedia = [...mediaItems, created];
    setMediaItems(nextMedia);
    setBoards((prev) =>
      syncBoardMembershipsLocally(prev, nextMedia, created.id, {
        boardIds: created.boardIds ?? [],
      }),
    );
    toast.success('Added (demo only)');
  };

  const handleAddBoard = async (input: CreateBoardInput) => {
    const newBoard: Board = {
      id: demoId('board'),
      name: input.name,
      description: input.description,
      isPublic: input.isPublic,
      type: input.type,
      coverImage: input.coverImageDataUrl,
      mediaIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setBoards((prev) => sortBoardsWithAllFirst([...prev, newBoard]));
    const nextCustomOrder = mergeCustomOrder(boardCustomOrder, [newBoard.id]);
    if (nextCustomOrder.length !== boardCustomOrder.length) {
      setBoardCustomOrder(nextCustomOrder);
    }
    toast.success('Board created (demo only)');
  };

  const handleUpdateMedia = async (
    mediaId: string,
    updates: Partial<MediaItem>,
    boardIds?: string[],
  ) => {
    const nextMedia = mediaItems.map((item) =>
      item.id === mediaId
        ? { ...item, ...updates, boardIds: boardIds ?? updates.boardIds ?? item.boardIds }
        : item,
    );
    setMediaItems(nextMedia);
    setSelectedMedia((prev) =>
      prev?.id === mediaId
        ? { ...prev, ...updates, boardIds: boardIds ?? updates.boardIds ?? prev.boardIds }
        : prev,
    );
    if (boardIds !== undefined) {
      setBoards((prev) =>
        syncBoardMembershipsLocally(prev, nextMedia, mediaId, { boardIds }),
      );
    }
    toast.success('Updated (demo only)');
  };

  const handleUpdateNotes = async (mediaId: string, notes: string) => {
    await handleUpdateMedia(mediaId, { notes });
  };

  const handleDeleteMedia = async (mediaId: string) => {
    const nextMedia = mediaItems.filter((item) => item.id !== mediaId);
    setMediaItems(nextMedia);
    setBoards((prev) =>
      syncBoardMembershipsLocally(prev, nextMedia, mediaId, { remove: true }),
    );
    setSelectedMedia(null);
    setDetailDialogOpen(false);
    toast.success('Removed (demo only)');
  };

  const handleUpdateBoard = async (
    boardId: string,
    updates: Partial<Board> & { coverImageDataUrl?: string },
  ) => {
    const { coverImageDataUrl, ...boardUpdates } = updates;
    setBoards((prev) =>
      prev.map((board) =>
        board.id === boardId
          ? {
              ...board,
              ...boardUpdates,
              coverImage: coverImageDataUrl ?? boardUpdates.coverImage ?? board.coverImage,
            }
          : board,
      ),
    );
    toast.success('Board updated (demo only)');
  };

  const handleDeleteBoard = async (boardId: string) => {
    setBoards((prev) => prev.filter((board) => board.id !== boardId));
    if (boardIdFromUrl === boardId) go(APP_ROUTES.library);
    toast.success('Board deleted (demo only)');
  };

  const handleBoardMediaOrderChange = async (boardId: string, mediaIds: string[]) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === boardId ? { ...b, mediaIds } : b)),
    );
  };

  const handleAddFriend = (targetUser: User) => {
    if (friends.some((f) => f.user.id === targetUser.id)) {
      toast.error('Already added');
      return;
    }
    setFriends((prev) => [
      ...prev,
      {
        id: targetUser.id,
        user: targetUser,
        status: 'pending',
        direction: 'outgoing',
        addedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    toast.success(`Friend request sent to @${targetUser.username} (demo)`);
  };

  const handleAcceptFriend = (friendId: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === friendId ? { ...f, status: 'accepted', direction: undefined } : f,
      ),
    );
    toast.success('Friend request accepted (demo)');
  };

  const handleRejectFriend = (friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    toast.info('Request declined (demo)');
  };

  const handleUnfriend = (friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    toast.success('Friend removed (demo)');
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      <div className="bg-amber-50 border-b border-amber-200/80 text-amber-950">
        <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            <span className="font-medium">Demo mode</span>
            <span className="text-amber-900/80"> — changes stay until you refresh.</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(APP_ROUTES.signUp)}>
              Sign up
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExitDemo}>
              Exit demo
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <button
              type="button"
              onClick={() => go(APP_ROUTES.library)}
              className="rounded-lg hover:opacity-90 transition-opacity text-left"
              aria-label="Go to library"
            >
              <BrandMark size="md" />
            </button>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <div className="text-sm">{user.displayName}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="onboarding-account-menu"
                    type="button"
                    className="rounded-full cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Account menu"
                  >
                    <UserAvatar
                      displayName={user.displayName}
                      avatar={user.avatar}
                      size="sm"
                      accentColor={accentColor}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 z-[120]">
                  <DropdownMenuItem onClick={() => go(APP_ROUTES.profile)}>
                    <UserIcon className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExitDemo}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Exit Demo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {showProfile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => go(APP_ROUTES.library)}>
                ← Back
              </Button>
              <h1>Profile</h1>
            </div>
            <ProfilePage
              user={user}
              mediaItems={mediaItems}
              accentColor={accentColor}
              onUpdateProfile={async (data) => {
                setUser((prev) => ({
                  ...prev,
                  displayName: data.displayName,
                  bio: data.bio,
                  avatar: data.avatar,
                }));
                toast.success('Profile updated (demo only)');
              }}
            />
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(tab) => {
              if (tab === 'library' || tab === 'recommendations' || tab === 'friends') {
                go(tabToRoute(tab));
              }
            }}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="library" className="flex items-center gap-2">
                <Library className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Recommendations</span>
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Friends</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="mt-6">
              {boardIdFromUrl && !selectedBoard ? (
                <p className="text-muted-foreground">Board not found.</p>
              ) : selectedBoard ? (
                <BoardDetailPage
                  board={selectedBoard}
                  mediaItems={getBoardMediaItems(selectedBoard, mediaItems)}
                  onBack={() => go(APP_ROUTES.library)}
                  onMediaClick={(media) => {
                    setSelectedMedia(media);
                    setDetailDialogOpen(true);
                  }}
                  onUpdateBoard={handleUpdateBoard}
                  onDeleteBoard={handleDeleteBoard}
                  customMediaTypes={customMediaTypes}
                  customGenres={customGenres}
                  mediaSortMode={mediaSortMode}
                  onMediaSortModeChange={(mode) => setMediaSortMode(mode)}
                  onBoardMediaOrderChange={handleBoardMediaOrderChange}
                />
              ) : (
                <LibraryPage
                  boards={visibleBoards}
                  mediaItems={mediaItems}
                  boardsLoading={false}
                  onBoardClick={(board) => go(APP_ROUTES.libraryBoard(board.id))}
                  onCreateBoard={() => setAddBoardDialogOpen(true)}
                  accentColor={accentColor}
                  customMediaTypes={customMediaTypes}
                  boardSortMode={boardSortMode}
                  boardCustomOrder={boardCustomOrder}
                  onBoardSortModeChange={(mode) => setBoardSortMode(mode)}
                  onBoardCustomOrderChange={(order) => setBoardCustomOrder(order)}
                />
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="mt-6">
              <RecommendationsPage
                mediaItems={mediaItems}
                userId={user.id}
                boards={boards}
                preferredGenres={DEMO_PREFERRED_GENRES}
                preferredMediaTypes={DEMO_PREFERRED_MEDIA_TYPES}
                customMediaTypes={customMediaTypes}
                customGenres={customGenres}
                maxRefreshes={2}
                demoMode
                onAddMedia={handleAddMedia}
              />
            </TabsContent>

            <TabsContent value="friends" className="mt-6">
              <FriendsPage
                friends={friends}
                currentUser={user}
                accentColor={accentColor}
                demoMode
                demoPosts={demoPosts}
                demoSearchUsers={DEMO_SEARCHABLE_USERS}
                onAddFriend={handleAddFriend}
                onAcceptFriend={handleAcceptFriend}
                onRejectFriend={handleRejectFriend}
                onUnfriend={handleUnfriend}
                onViewUserProfile={() => {
                  toast.info('Friend profiles aren’t available in demo');
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AddMediaDialog
        onAdd={handleAddMedia}
        boards={boards}
        currentBoardId={boardIdFromUrl ?? undefined}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onOpenChange={setAddMediaDialogOpen}
      />

      <AddBoardDialog
        open={addBoardDialogOpen}
        onOpenChange={setAddBoardDialogOpen}
        onAdd={handleAddBoard}
        customMediaTypes={customMediaTypes}
      />

      <MediaDetailDialog
        media={selectedMedia}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        boards={boards}
        onUpdateNotes={handleUpdateNotes}
        onUpdateMedia={handleUpdateMedia}
        onDelete={handleDeleteMedia}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        accentColor={accentColor}
        themeSettings={themeSettings}
        onThemePreview={(settings) => {
          setThemeSettings(settings);
          setAccentColor(applyAppTheme(settings));
        }}
        onSaveTheme={async (settings) => {
          setThemeSettings(settings);
          setAccentColor(applyAppTheme(settings));
          toast.success('Theme saved (demo only)');
        }}
        email={user.email}
        username={user.username}
        avatar={user.avatar}
        displayName={user.displayName}
        onSaveAccountSettings={async (data) => {
          setUser((prev) => ({
            ...prev,
            username: data.username,
            email: data.email,
            avatar: data.avatar,
          }));
          toast.success('Account saved (demo only)');
        }}
        onChangePassword={async () => {
          toast.info('Password changes aren’t available in demo');
        }}
        onDeleteAccount={async () => {
          toast.info('Account deletion isn’t available in demo');
        }}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onSaveCustomGenres={async (genres) => {
          setCustomGenres(genres);
          toast.success('Genres saved (demo only)');
        }}
        onSaveCustomMediaTypes={async (types) => {
          setCustomMediaTypes(types);
          toast.success('Media types saved (demo only)');
        }}
        showAllBoard={showAllBoard}
        publicBoardsFriendsOnly={publicBoardsFriendsOnly}
        onSaveLibrarySettings={async (data) => {
          setShowAllBoard(data.showAllBoard);
          setPublicBoardsFriendsOnly(data.publicBoardsFriendsOnly);
          if (!data.showAllBoard && selectedBoard && isAllBoard(selectedBoard)) {
            go(APP_ROUTES.library);
          }
          toast.success('Library settings saved (demo only)');
        }}
      />

      {showOnboardingTour && (
        <OnboardingTour
          onComplete={() => setShowOnboardingTour(false)}
          addBoardDialogOpen={addBoardDialogOpen}
          addMediaDialogOpen={addMediaDialogOpen}
          onEnsureLibrary={() => go(APP_ROUTES.library)}
        />
      )}
    </div>
  );
}
