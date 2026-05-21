import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { LibraryPage } from './components/LibraryPage';
import { BoardDetailPage } from './components/BoardDetailPage';
import { FriendsPage } from './components/FriendsPage';
import { RecommendationsPage } from './components/RecommendationsPage';
import { AddMediaDialog } from './components/AddMediaDialog';
import { AddBoardDialog } from './components/AddBoardDialog';
import { MediaDetailDialog } from './components/MediaDetailDialog';
import { ProfilePage } from './components/ProfilePage';
import { SettingsDialog } from './components/SettingsDialog';
import { Button } from './components/ui/button';
import {
  mockRecommendations,
  mockFriendActivity
} from './data/mockData';
import { getDefaultBoards, createDefaultUser } from './data/defaults';
import { MediaItem, Friend, Board, UserStats } from './types/media';
import { Library, User, Users, Sparkles, Settings } from 'lucide-react';
import { toast, Toaster } from 'sonner@2.0.3';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import logoImage from 'figma:asset/5583514ac2fafeffa204feebf3730658f30d11ab.png';

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

  const handleAddMedia = (newMedia: MediaItem, boardIds?: string[]) => {
    setMediaItems([...mediaItems, newMedia]);
    
    // Add media to appropriate default boards based on status
    const allBoard = boards.find(board => board.name === 'All');
    const watchlistBoard = boards.find(board => board.name === 'Watchlist');
    const boardIdsToUpdate = new Set(boardIds || []);
    
    // Add to "All" board if watched, watching, or dropped
    if (allBoard && ['watched', 'watching', 'dropped'].includes(newMedia.status)) {
      boardIdsToUpdate.add(allBoard.id);
    }
    
    // Add to "Watchlist" board if want-to-watch
    if (watchlistBoard && newMedia.status === 'want-to-watch') {
      boardIdsToUpdate.add(watchlistBoard.id);
    }
    
    if (boardIdsToUpdate.size > 0) {
      setBoards(boards.map(board => {
        if (boardIdsToUpdate.has(board.id)) {
          return {
            ...board,
            mediaIds: [...board.mediaIds, newMedia.id]
          };
        }
        return board;
      }));
    }
    
    toast.success('Media added to your library!');
  };

  const handleAddBoard = (newBoard: Board) => {
    setBoards([...boards, newBoard]);
    toast.success('Board created successfully!');
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

  const handleUpdateNotes = (mediaId: string, notes: string) => {
    setMediaItems(mediaItems.map(item => 
      item.id === mediaId ? { ...item, notes } : item
    ));
    setSelectedMedia(prev => prev ? { ...prev, notes } : null);
    toast.success('Notes updated');
  };

  const handleUpdateMedia = (mediaId: string, updates: Partial<MediaItem>) => {
    setMediaItems(mediaItems.map(item => 
      item.id === mediaId ? { ...item, ...updates } : item
    ));
    setSelectedMedia(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Media updated successfully!');
  };

  const handleDeleteMedia = (mediaId: string) => {
    setMediaItems(mediaItems.filter(item => item.id !== mediaId));
    toast.success('Media removed from your library');
  };

  const handleUpdateBoard = (boardId: string, updates: Partial<Board>) => {
    setBoards(boards.map(board => 
      board.id === boardId ? { ...board, ...updates } : board
    ));
    setSelectedBoard(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Board settings updated');
  };

  const handleDeleteBoard = (boardId: string) => {
    setBoards(boards.filter(board => board.id !== boardId));
    setSelectedBoard(null);
    toast.success('Board deleted successfully');
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

  const handleAddCustomGenre = (genre: string) => {
    if (!customGenres.includes(genre)) {
      setCustomGenres([...customGenres, genre]);
      toast.success(`Genre "${genre}" added!`);
    }
  };

  const handleAddCustomMediaType = (type: string) => {
    if (!customMediaTypes.includes(type)) {
      setCustomMediaTypes([...customMediaTypes, type]);
      toast.success(`Media type "${type}" added!`);
    }
  };

  const handleAccentColorChange = (color: string) => {
    setAccentColor(color);
    toast.success(`Accent color updated!`);
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



  // Calculate stats dynamically from mediaItems
  const calculatedStats: UserStats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    
    mediaItems.forEach(item => {
      if (item.status === 'watched') {
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
                board={selectedBoard}
                mediaItems={mediaItems.filter(item => selectedBoard.mediaIds.includes(item.id))}
                onBack={handleBackToLibrary}
                onMediaClick={handleMediaClick}
                onUpdateBoard={handleUpdateBoard}
                onDeleteBoard={handleDeleteBoard}
              />
            ) : (
              <LibraryPage
                boards={boards}
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
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onAddCustomGenre={handleAddCustomGenre}
        onAddCustomMediaType={handleAddCustomMediaType}
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
        onUpdateNotes={handleUpdateNotes}
        onUpdateMedia={handleUpdateMedia}
        onDelete={handleDeleteMedia}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onAddCustomGenre={handleAddCustomGenre}
        onAddCustomMediaType={handleAddCustomMediaType}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        accentColor={accentColor}
        onAccentColorChange={handleAccentColorChange}
        username={user.username}
        onSaveAccountSettings={handleSaveAccountSettings}
      />
    </div>
  );
}

export default App;
