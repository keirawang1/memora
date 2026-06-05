import { useState, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './app/components/ui/tabs';
import { LibraryPage } from './app/components/LibraryPage';
import { BoardDetailPage } from './app/components/BoardDetailPage';
import { FriendsPage } from './app/components/FriendsPage';
import { RecommendationsPage } from './app/components/RecommendationsPage';
import { AddMediaDialog } from './app/components/AddMediaDialog';
import { AddBoardDialog } from './app/components/AddBoardDialog';
import { MediaDetailDialog } from './app/components/MediaDetailDialog';
import { ProfilePage } from './app/components/ProfilePage';
import { UserProfilePage } from './app/components/UserProfilePage';
import { UserAvatar } from './app/components/UserAvatar';
import { NotificationCenter } from './app/components/NotificationCenter';
import { SettingsDialog } from './app/components/SettingsDialog';
import { Button } from './app/components/ui/button';
import { mockRecommendations } from './app/data/mockData';
import { DEFAULT_ACCENT_COLOR, getDefaultBoards, createDefaultUser } from './app/data/defaults';
import { computeMediaTypeCounts } from './app/data/analytics';
import { isValidAccentHex } from './app/utils/accentColor';
import {
  filterBoardsForDisplay,
  getBoardMediaItems,
  isAllBoard,
  sortBoardsWithAllFirst,
} from './app/data/allBoard';
import { mergeCustomOrder } from './app/data/sortOrder';
import type { MediaItem, Friend, Board, UserStats, User } from './app/types/media';
import { Library, User as UserIcon, Users, Sparkles, Settings, LogOut } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './app/components/ui/dropdown-menu';
import logoImage from './assets/logo.png';
import { supabase } from './app/supabase/client';
import { createBoard, fetchBoards, updateBoard, deleteBoard, updateBoardMediaOrder } from './app/supabase/boards';
import {
  createMedia,
  deleteMedia,
  fetchMedia,
  updateMedia,
  type CreateMediaInput,
} from './app/supabase/media';
import {
  acceptFriendRequest,
  fetchFriends,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from './app/supabase/friends';
import {
  ensureUserProfile,
  getUserAccentColor,
  getUserProfile,
  getUserTagPreferences,
  updateUserAccentColor,
  updateUserGenres,
  updateUserMediaTypes,
  updateUserProfile,
  updateUserShowAllBoard,
  updateUsername,
  updateUserBoardSort,
  updateUserMediaSort,
} from './app/supabase/users';
import type { SortMode } from './app/types/sort';
import { AuthPage } from './app/components/AuthPage';

function App() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [boards, setBoards] = useState<Board[]>(getDefaultBoards());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('library');
  const [showProfile, setShowProfile] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [user, setUser] = useState(createDefaultUser());
  const [userStats, setUserStats] = useState<UserStats>({
    totalWatched: 0,
    moviesWatched: 0,
    tvShowsWatched: 0,
    animeWatched: 0,
    comicsRead: 0,
    booksRead: 0,
    hoursSpent: 0,
  });
  
  // Custom genres and media types
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [customMediaTypes, setCustomMediaTypes] = useState<string[]>([]);
  const [showAllBoard, setShowAllBoard] = useState(true);
  const [boardSortMode, setBoardSortMode] = useState<SortMode>('alphabetical');
  const [boardCustomOrder, setBoardCustomOrder] = useState<string[]>([]);
  const [mediaSortMode, setMediaSortMode] = useState<SortMode>('alphabetical');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const accentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUserTagPreferences = async (userId: string) => {
    try {
      const prefs = await getUserTagPreferences(userId);
      setCustomGenres(prefs.genres);
      setCustomMediaTypes(prefs.mediaTypes);
      setShowAllBoard(prefs.showAllBoard);
      setBoardSortMode(prefs.librarySort.boardSortMode);
      setBoardCustomOrder(prefs.librarySort.boardCustomOrder);
      setMediaSortMode(prefs.librarySort.mediaSortMode);
    } catch {
      setCustomGenres([]);
      setCustomMediaTypes([]);
      setShowAllBoard(true);
      setBoardSortMode('alphabetical');
      setBoardCustomOrder([]);
      setMediaSortMode('alphabetical');
    }
  };

  const persistBoardCustomOrder = async (order: string[]) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    await updateUserBoardSort(authUser.id, boardSortMode, order);
  };

  const loadLibraryForUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      setAccentColor(await getUserAccentColor(user.id));
    } catch {
      // Keep current accent if load fails
    }

    let fetchedMedia: MediaItem[] = [];
    try {
      fetchedMedia = await fetchMedia();
      setMediaItems(fetchedMedia);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load media';
      toast.error(message);
    }

    try {
      const fetchedBoards = await fetchBoards(fetchedMedia);
      setBoards(fetchedBoards);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load boards';
      toast.error(message);
    }

    try {
      await loadUserTagPreferences(user.id);
    } catch {
      setCustomGenres([]);
      setCustomMediaTypes([]);
      setShowAllBoard(true);
    }

    try {
      setFriends(await fetchFriends(user.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load friends';
      toast.error(message);
      setFriends([]);
    }
  };

  const handleAuthSuccess = (
    userId: string,
    username: string,
    displayName: string,
    email: string,
    _accessToken: string,
    avatar?: string,
    bio?: string,
  ) => {
    setUser({
      id: userId,
      username,
      displayName,
      email,
      avatar,
      bio: bio ?? '',
    });
    setIsAuthenticated(true);
    void loadLibraryForUser();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setBoards(getDefaultBoards());
    setMediaItems([]);
    setCustomGenres([]);
    setCustomMediaTypes([]);
    setShowAllBoard(true);
    setBoardSortMode('alphabetical');
    setBoardCustomOrder([]);
    setMediaSortMode('alphabetical');
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setUser(createDefaultUser());
    setShowProfile(false);
    setViewingUserId(null);
    setSelectedBoard(null);
    setFriends([]);
    toast.info('Signed out');
  };

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && mounted) {
        try {
          const profile =
            (await getUserProfile(session.user.id)) ??
            (await ensureUserProfile(
              session.user.id,
              session.user.email ?? '',
            ));

          handleAuthSuccess(
            session.user.id,
            profile.username,
            profile.displayName,
            profile.email,
            session.access_token,
            profile.avatar,
            profile.bio,
          );
        } catch {
          if (mounted) setIsAuthenticated(false);
        }
      }

      if (mounted) setAuthChecking(false);
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, _session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setBoards(getDefaultBoards());
          setMediaItems([]);
          setFriends([]);
          setCustomGenres([]);
          setCustomMediaTypes([]);
          setShowAllBoard(true);
          setBoardSortMode('alphabetical');
          setBoardCustomOrder([]);
          setMediaSortMode('alphabetical');
          setUser(createDefaultUser());
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAddMedia = async (
    newMedia: Omit<MediaItem, 'id' | 'dateAdded'> & { id?: string },
    boardIds?: string[],
  ) => {
    try {
      const input: CreateMediaInput = {
        title: newMedia.title,
        type: newMedia.type,
        genre: newMedia.genre,
        status: newMedia.status,
        imageUrl: newMedia.imageUrl,
        gallery: newMedia.gallery,
        rating: newMedia.rating,
        dateStarted: newMedia.dateStarted,
        dateCompleted: newMedia.dateCompleted,
        notes: newMedia.notes,
        boardIds: boardIds ?? [],
      };
      const created = await createMedia(input);
      const nextMedia = [...mediaItems, created];
      setMediaItems(nextMedia);
      try {
        setBoards(await fetchBoards(nextMedia));
      } catch {
        // Keep new media in state if board refresh fails
      }

      toast.success('Media added to your library!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add media';
      toast.error(message);
      throw error;
    }
  };

  const handleAddBoard = async (input: Parameters<typeof createBoard>[0]) => {
    try {
      const newBoard = await createBoard(input);
      setBoards((prev) =>
        sortBoardsWithAllFirst([...prev.filter((b) => b.id !== newBoard.id), newBoard]),
      );
      const nextCustomOrder = mergeCustomOrder(boardCustomOrder, [newBoard.id]);
      if (nextCustomOrder.length !== boardCustomOrder.length) {
        setBoardCustomOrder(nextCustomOrder);
        try {
          await persistBoardCustomOrder(nextCustomOrder);
        } catch {
          // Board list still works if custom order save fails
        }
      }
      try {
        setBoards(await fetchBoards(mediaItems));
      } catch {
        // Keep optimistic board if refresh fails
      }
      toast.success('Board created successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create board';
      toast.error(message);
      throw error;
    }
  };

  const handleBoardClick = (board: Board) => {
    setSelectedBoard(board);
  };

  const handleBackToLibrary = () => {
    setSelectedBoard(null);
  };

  const handleMediaClick = (media: MediaItem) => {
    setSelectedMedia(media);
    setDetailDialogOpen(true);
  };

  const handleUpdateNotes = async (mediaId: string, notes: string) => {
    try {
      const updated = await updateMedia(mediaId, { notes });
      setMediaItems((prev) =>
        prev.map((item) => (item.id === mediaId ? updated : item)),
      );
      setSelectedMedia((prev) => (prev?.id === mediaId ? updated : prev));
      toast.success('Notes updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update notes';
      toast.error(message);
    }
  };

  const handleUpdateMedia = async (
    mediaId: string,
    updates: Partial<MediaItem>,
    boardIds?: string[],
  ) => {
    try {
      const updated = await updateMedia(mediaId, {
        title: updates.title,
        type: updates.type,
        genre: updates.genre,
        status: updates.status,
        imageUrl: updates.imageUrl,
        gallery: updates.gallery,
        rating: updates.rating,
        dateStarted: updates.dateStarted,
        dateCompleted: updates.dateCompleted,
        notes: updates.notes,
        boardIds,
      });
      const nextMedia = mediaItems.map((item) =>
        item.id === mediaId ? updated : item,
      );
      setMediaItems(nextMedia);
      setSelectedMedia((prev) => (prev?.id === mediaId ? updated : prev));
      setBoards(await fetchBoards(nextMedia));

      toast.success('Media updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update media';
      toast.error(message);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await deleteMedia(mediaId);
      const nextMedia = mediaItems.filter((item) => item.id !== mediaId);
      setMediaItems(nextMedia);
      setBoards(await fetchBoards(nextMedia));
      setSelectedMedia(null);
      setDetailDialogOpen(false);
      toast.success('Media removed from your library');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete media';
      toast.error(message);
    }
  };

  const handleUpdateBoard = async (
    boardId: string,
    updates: Partial<Board> & { coverImageDataUrl?: string },
  ) => {
    try {
      const { coverImageDataUrl, ...boardUpdates } = updates;
      const updated = await updateBoard(boardId, {
        ...boardUpdates,
        coverImageDataUrl,
      });
      setBoards((prev) => prev.map((board) => (board.id === boardId ? updated : board)));
      setSelectedBoard((prev) => (prev?.id === boardId ? updated : prev));
      toast.success('Board settings updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update board';
      toast.error(message);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((board) => board.id !== boardId));
      setSelectedBoard(null);
      toast.success('Board deleted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete board';
      toast.error(message);
    }
  };


  const handleCreateBoard = () => {
    setAddBoardDialogOpen(true);
  };

  const handleAddFriend = async (targetUser: User) => {
    if (targetUser.id === user.id) {
      toast.error("You can't add yourself");
      return;
    }
    const existing = friends.find((f) => f.user.id === targetUser.id);
    if (existing?.status === 'accepted') {
      toast.error('Already friends');
      return;
    }
    if (existing?.status === 'pending' && existing.direction === 'outgoing') {
      toast.error('Friend request already sent');
      return;
    }
    if (existing?.status === 'pending' && existing.direction === 'incoming') {
      toast.error('They already sent you a request — accept it below');
      return;
    }

    try {
      await sendFriendRequest(targetUser.id);
      setFriends(await fetchFriends(user.id));
      setNotificationRefreshKey((k) => k + 1);
      toast.success(`Friend request sent to @${targetUser.username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send friend request';
      toast.error(message);
    }
  };

  const handleAcceptFriend = async (requesterId: string) => {
    try {
      await acceptFriendRequest(requesterId);
      setFriends(await fetchFriends(user.id));
      setNotificationRefreshKey((k) => k + 1);
      toast.success('Friend request accepted!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept friend request';
      toast.error(message);
    }
  };

  const handleRejectFriend = async (requesterId: string) => {
    try {
      await rejectFriendRequest(requesterId);
      setFriends(await fetchFriends(user.id));
      toast.info('Friend request rejected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject friend request';
      toast.error(message);
    }
  };

  const handleUnfriend = async (friendUserId: string) => {
    try {
      await removeFriend(friendUserId);
      setFriends(await fetchFriends(user.id));
      toast.success('Friend removed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove friend';
      toast.error(message);
    }
  };

  const handleSaveCustomGenres = async (genres: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserGenres(user.id, genres);
      setCustomGenres(genres);
      toast.success('Custom genres saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save genres';
      toast.error(message);
      throw error;
    }
  };

  const handleShowAllBoardChange = async (show: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserShowAllBoard(user.id, show);
      setShowAllBoard(show);
      if (!show && selectedBoard && isAllBoard(selectedBoard)) {
        setSelectedBoard(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update setting';
      toast.error(message);
    }
  };

  const handleSaveCustomMediaTypes = async (mediaTypes: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserMediaTypes(user.id, mediaTypes);
      setCustomMediaTypes(mediaTypes);
      toast.success('Custom media types saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save media types';
      toast.error(message);
      throw error;
    }
  };

  const handleAccentColorChange = (color: string) => {
    setAccentColor(color);
    if (!isValidAccentHex(color)) return;

    if (accentSaveTimerRef.current) {
      clearTimeout(accentSaveTimerRef.current);
    }

    accentSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) return;
          const saved = await updateUserAccentColor(authUser.id, color);
          setAccentColor(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to save accent color';
          toast.error(message);
        }
      })();
    }, 350);
  };

  const handleViewUserProfile = (userId: string) => {
    if (userId === user.id) {
      setViewingUserId(null);
      setShowProfile(true);
      setSelectedBoard(null);
      return;
    }
    setViewingUserId(userId);
    setShowProfile(false);
    setSelectedBoard(null);
  };

  const handleGoToLibrary = () => {
    setViewingUserId(null);
    setShowProfile(false);
    setSelectedBoard(null);
    setActiveTab('library');
  };

  const handleViewOwnProfile = () => {
    setViewingUserId(null);
    setShowProfile(true);
    setSelectedBoard(null);
  };

  const handleUpdateProfile = async (data: { displayName: string; bio: string; avatar?: string }) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');
      const profile = await updateUserProfile(authUser.id, data);
      setUser({
        ...user,
        displayName: profile.displayName,
        bio: profile.bio ?? data.bio.trim(),
        avatar: profile.avatar,
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
      throw error;
    }
  };

  const handleBoardSortModeChange = async (mode: SortMode) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setBoardSortMode(mode);
    try {
      await updateUserBoardSort(authUser.id, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save sort preference';
      toast.error(message);
    }
  };

  const handleBoardCustomOrderChange = async (order: string[]) => {
    setBoardCustomOrder(order);
    try {
      await persistBoardCustomOrder(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save board order';
      toast.error(message);
    }
  };

  const handleMediaSortModeChange = async (mode: SortMode) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setMediaSortMode(mode);
    try {
      await updateUserMediaSort(authUser.id, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save sort preference';
      toast.error(message);
    }
  };

  const handleBoardMediaOrderChange = async (boardId: string, mediaIds: string[]) => {
    try {
      const updated = await updateBoardMediaOrder(boardId, mediaIds);
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, mediaIds: updated.mediaIds } : b)),
      );
      if (selectedBoard?.id === boardId) {
        setSelectedBoard((prev) =>
          prev ? { ...prev, mediaIds: updated.mediaIds } : prev,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save media order';
      toast.error(message);
      throw error;
    }
  };

  const handleSaveAccountSettings = async (data: { username: string }) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');
      const profile = await updateUsername(authUser.id, data.username);
      setUser({
        ...user,
        username: profile.username,
      });
      toast.success('Account settings saved!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save username';
      toast.error(message);
      throw error;
    }
  };



  const visibleBoards = useMemo(
    () => filterBoardsForDisplay(boards, showAllBoard),
    [boards, showAllBoard],
  );

  // Calculate stats dynamically from mediaItems
  const calculatedStats: UserStats = useMemo(() => {
    const typeCount = computeMediaTypeCounts(mediaItems);
    const totalWatched = Object.values(typeCount).reduce((sum, count) => sum + count, 0);

    return {
      totalWatched,
      moviesWatched: typeCount['movie'] || 0,
      tvShowsWatched: typeCount['tv'] || 0,
      animeWatched: typeCount['anime'] || 0,
      comicsRead: typeCount['comic'] || 0,
      booksRead: typeCount['book'] || 0,
      hoursSpent: 0,
      customTypeCounts: typeCount,
    };
  }, [mediaItems]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster position="top-center" richColors />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      
      <div className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              type="button"
              onClick={handleGoToLibrary}
              className="flex items-center gap-2 rounded-lg hover:opacity-90 transition-opacity text-left"
              aria-label="Go to library"
            >
              <div className="w-20 h-20 rounded-lg flex items-center justify-center">
                <img src={logoImage} alt="Memora" className="w-20 h-20" />
              </div>
              <div>
                <h2 className="tracking-tight">Memora</h2>
                <p className="text-xs text-muted-foreground">Your taste, redefined.</p>
              </div>
            </button>
            
            <div className="flex items-center gap-3">
              <NotificationCenter
                accentColor={accentColor}
                refreshKey={notificationRefreshKey}
                onOpenFriends={() => {
                  setViewingUserId(null);
                  setShowProfile(false);
                  setActiveTab('friends');
                }}
                onViewUserProfile={handleViewUserProfile}
              />
              <div className="hidden sm:block">
                <div className="text-sm">{user.displayName}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleViewOwnProfile}>
                    <UserIcon className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {viewingUserId ? (
          <UserProfilePage
            userId={viewingUserId}
            onBack={() => setViewingUserId(null)}
            accentColor={accentColor}
          />
        ) : showProfile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setShowProfile(false)}>
                ← Back
              </Button>
              <h1>Profile</h1>
            </div>
            <ProfilePage
              user={user}
              mediaItems={mediaItems}
              accentColor={accentColor}
              onUpdateProfile={handleUpdateProfile}
            />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            {selectedBoard ? (
              <BoardDetailPage
                board={boards.find(b => b.id === selectedBoard.id) ?? selectedBoard}
                mediaItems={getBoardMediaItems(
                  boards.find(b => b.id === selectedBoard.id) ?? selectedBoard,
                  mediaItems,
                )}
                onBack={handleBackToLibrary}
                onMediaClick={handleMediaClick}
                onUpdateBoard={handleUpdateBoard}
                onDeleteBoard={handleDeleteBoard}
                customMediaTypes={customMediaTypes}
                customGenres={customGenres}
                mediaSortMode={mediaSortMode}
                onMediaSortModeChange={handleMediaSortModeChange}
                onBoardMediaOrderChange={handleBoardMediaOrderChange}
              />
            ) : (
              <LibraryPage
                boards={visibleBoards}
                mediaItems={mediaItems}
                onBoardClick={handleBoardClick}
                onCreateBoard={handleCreateBoard}
                accentColor={accentColor}
                customMediaTypes={customMediaTypes}
                boardSortMode={boardSortMode}
                boardCustomOrder={boardCustomOrder}
                onBoardSortModeChange={handleBoardSortModeChange}
                onBoardCustomOrderChange={handleBoardCustomOrderChange}
              />
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <RecommendationsPage
              recommendations={mockRecommendations}
              onMediaClick={handleMediaClick}
              boards={boards}
              onAddMedia={handleAddMedia}
            />
          </TabsContent>

          <TabsContent value="friends" className="mt-6">
            <FriendsPage
              friends={friends}
              currentUser={user}
              accentColor={accentColor}
              onAddFriend={handleAddFriend}
              onAcceptFriend={handleAcceptFriend}
              onRejectFriend={handleRejectFriend}
              onUnfriend={handleUnfriend}
              onViewUserProfile={handleViewUserProfile}
            />
          </TabsContent>
          </Tabs>
        )}
      </div>

      <AddMediaDialog
        onAdd={handleAddMedia}
        boards={boards}
        currentBoardId={selectedBoard?.id}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        accentColor={accentColor}
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
        onAccentColorChange={handleAccentColorChange}
        username={user.username}
        onSaveAccountSettings={handleSaveAccountSettings}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onSaveCustomGenres={handleSaveCustomGenres}
        onSaveCustomMediaTypes={handleSaveCustomMediaTypes}
        showAllBoard={showAllBoard}
        onShowAllBoardChange={handleShowAllBoardChange}
      />
    </div>
  );
}

export default App;