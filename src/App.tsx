import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './app/components/ui/tabs';
import { LibraryPage } from './app/components/LibraryPage';
import { BoardDetailPage } from './app/components/BoardDetailPage';
import { FriendsPage } from './app/components/FriendsPage';
import { RecommendationsPage } from './app/components/RecommendationsPage';
import { AddMediaDialog } from './app/components/AddMediaDialog';
import { AddBoardDialog } from './app/components/AddBoardDialog';
import { MediaDetailDialog } from './app/components/MediaDetailDialog';
import { ProfilePage } from './app/components/ProfilePage';
import { SettingsDialog } from './app/components/SettingsDialog';
import { Button } from './app/components/ui/button';
import {
  mockRecommendations,
  mockFriendActivity
} from './app/data/mockData';
import { getDefaultBoards, createDefaultUser } from './app/data/defaults';
import { filterBoardsForDisplay, isAllBoard, sortBoardsWithAllFirst } from './app/data/allBoard';
import type { MediaItem, Friend, Board, UserStats } from './app/types/media';
import { Library, User, Users, Sparkles, Settings, LogOut } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './app/components/ui/dropdown-menu';
import logoImage from './assets/logo.png';
import { supabase } from './app/supabase/client';
import { createBoard, fetchBoards, updateBoard, deleteBoard } from './app/supabase/boards';
import {
  createMedia,
  deleteMedia,
  fetchMedia,
  updateMedia,
  type CreateMediaInput,
} from './app/supabase/media';
import {
  ensureUserProfile,
  getUserProfile,
  getUserTagPreferences,
  updateUserGenres,
  updateUserMediaTypes,
  updateUserShowAllBoard,
} from './app/supabase/users';
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
  const [accentColor, setAccentColor] = useState('#5C2B17');
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const loadUserTagPreferences = async (userId: string) => {
    try {
      const prefs = await getUserTagPreferences(userId);
      setCustomGenres(prefs.genres);
      setCustomMediaTypes(prefs.mediaTypes);
      setShowAllBoard(prefs.showAllBoard);
    } catch {
      setCustomGenres([]);
      setCustomMediaTypes([]);
      setShowAllBoard(true);
    }
  };

  const loadLibraryForUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
  };

  const handleAuthSuccess = (
    userId: string,
    username: string,
    displayName: string,
    email: string,
    _accessToken: string,
    avatar?: string,
  ) => {
    setUser({
      id: userId,
      username,
      displayName,
      email,
      avatar,
      bio: '',
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
    setUser(createDefaultUser());
    setShowProfile(false);
    setSelectedBoard(null);
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
          setCustomGenres([]);
          setCustomMediaTypes([]);
          setShowAllBoard(true);
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
    updates: Partial<Board> & { mediaType?: string; coverImageDataUrl?: string },
  ) => {
    try {
      const { mediaType: _mediaType, coverImageDataUrl, ...boardUpdates } = updates;
      const updated = await updateBoard(boardId, {
        name: boardUpdates.name,
        description: boardUpdates.description,
        isPublic: boardUpdates.isPublic,
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

  const handleAddFriend = (username: string) => {
    const newFriend: Friend = {
      id: `friend-${Date.now()}`,
      user: {
        id: `user-${Date.now()}`,
        username,
        displayName: username.charAt(0).toUpperCase() + username.slice(1).replace('_', ' '),
        avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop`,
      },
      status: 'pending',
      addedAt: new Date().toISOString().split('T')[0],
    };
    setFriends([...friends, newFriend]);
    toast.success(`Friend request sent to @${username}`);
  };

  const handleAcceptFriend = (friendId: string) => {
    setFriends(friends.map(f => 
      f.id === friendId ? { ...f, status: 'accepted' as const } : f
    ));
    toast.success('Friend request accepted!');
  };

  const handleRejectFriend = (friendId: string) => {
    setFriends(friends.filter(f => f.id !== friendId));
    toast.info('Friend request rejected');
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
  };

  const handleUpdateProfile = (data: { displayName: string; bio: string; avatar?: string }) => {
    setUser({
      ...user,
      displayName: data.displayName,
      bio: data.bio,
      avatar: data.avatar,
    });
    toast.success('Profile updated successfully!');
  };

  const handleSaveAccountSettings = (data: { username: string }) => {
    setUser({
      ...user,
      username: data.username,
    });
    toast.success('Account settings saved!');
  };



  const visibleBoards = useMemo(
    () => filterBoardsForDisplay(boards, showAllBoard),
    [boards, showAllBoard],
  );

  // Calculate stats dynamically from mediaItems
  const calculatedStats: UserStats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    
    mediaItems.forEach(item => {
      if (item.status === 'completed') {
        const type = item.type.toLowerCase();
        typeCount[type] = (typeCount[type] || 0) + 1;
      }
    });

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
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 rounded-lg flex items-center justify-center">
                <img src={logoImage} alt="Memora" className="w-20 h-20" />
              </div>
              <div>
                <h2 className="tracking-tight">Memora</h2>
                <p className="text-xs text-muted-foreground">Your taste, redefined.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm">{user.displayName}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                    style={!user.avatar ? { backgroundColor: accentColor } : undefined}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowProfile(true)}>
                    <User className="w-4 h-4 mr-2" />
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
        {showProfile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setShowProfile(false)}>
                ← Back
              </Button>
              <h1>Profile</h1>
            </div>
            <ProfilePage 
              user={user} 
              stats={calculatedStats} 
              mediaItems={mediaItems}
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
                mediaItems={
                  isAllBoard(boards.find(b => b.id === selectedBoard.id) ?? selectedBoard)
                    ? mediaItems
                    : mediaItems.filter((item) =>
                        (boards.find(b => b.id === selectedBoard.id) ?? selectedBoard).mediaIds.includes(item.id),
                      )
                }
                onBack={handleBackToLibrary}
                onMediaClick={handleMediaClick}
                onUpdateBoard={handleUpdateBoard}
                onDeleteBoard={handleDeleteBoard}
              />
            ) : (
              <LibraryPage
                boards={visibleBoards}
                mediaItems={mediaItems}
                onBoardClick={handleBoardClick}
                onCreateBoard={handleCreateBoard}
                accentColor={accentColor}
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
              friendActivity={mockFriendActivity}
              onAddFriend={handleAddFriend}
              onAcceptFriend={handleAcceptFriend}
              onRejectFriend={handleRejectFriend}
              onMediaClick={handleMediaClick}
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