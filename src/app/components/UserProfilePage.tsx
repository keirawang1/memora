import { useEffect, useState } from 'react';
import type { Board, MediaItem } from '../types/media';
import { BoardCard } from './BoardCard';
import { BoardDetailPage } from './BoardDetailPage';
import { MediaDetailDialog } from './MediaDetailDialog';
import { UserAvatar } from './UserAvatar';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import { DEFAULT_ACCENT_COLOR } from '../data/defaults';
import { DEFAULT_GENRES, DEFAULT_MEDIA_TYPES } from '../data/mediaOptions';
import { fetchPublicBoardsForUser } from '../supabase/boards';
import { fetchMediaForPublicBoard } from '../supabase/media';
import { getPublicUserProfile, type PublicUser } from '../supabase/users';

interface UserProfilePageProps {
  userId: string;
  onBack: () => void;
  accentColor?: string;
}

export function UserProfilePage({ userId, onBack, accentColor = DEFAULT_ACCENT_COLOR }: UserProfilePageProps) {
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [boardMedia, setBoardMedia] = useState<MediaItem[]>([]);
  const [loadingBoardMedia, setLoadingBoardMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setSelectedBoard(null);
      setBoardMedia([]);
      try {
        const [userProfile, publicBoards] = await Promise.all([
          getPublicUserProfile(userId),
          fetchPublicBoardsForUser(userId),
        ]);
        if (cancelled) return;
        if (!userProfile) {
          setError('User not found');
          setProfile(null);
          setBoards([]);
          return;
        }
        setProfile(userProfile);
        setBoards(publicBoards);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load profile');
          setProfile(null);
          setBoards([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleBoardClick = (board: Board) => {
    void (async () => {
      setLoadingBoardMedia(true);
      try {
        const media = await fetchMediaForPublicBoard(board.id);
        setBoardMedia(media);
        setSelectedBoard(board);
      } catch (err) {
        setBoardMedia([]);
        setSelectedBoard(null);
        setError(err instanceof Error ? err.message : 'Failed to load board media');
      } finally {
        setLoadingBoardMedia(false);
      }
    })();
  };

  const handleBackFromBoard = () => {
    setSelectedBoard(null);
    setBoardMedia([]);
  };

  if (loadingBoardMedia) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading board...
      </div>
    );
  }

  if (selectedBoard) {
    return (
      <>
        <BoardDetailPage
          board={selectedBoard}
          mediaItems={boardMedia}
          onBack={handleBackFromBoard}
          onMediaClick={(media) => {
            setSelectedMedia(media);
            setDetailDialogOpen(true);
          }}
          onUpdateBoard={async () => {}}
          customMediaTypes={[...DEFAULT_MEDIA_TYPES]}
          customGenres={[...DEFAULT_GENRES]}
          readOnly
          mediaSortMode="alphabetical"
          onMediaSortModeChange={async () => {}}
          onBoardMediaOrderChange={async () => {}}
        />
        <MediaDetailDialog
          media={selectedMedia}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          boards={[]}
          customGenres={[...DEFAULT_GENRES]}
          customMediaTypes={[...DEFAULT_MEDIA_TYPES]}
          readOnly
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1>Profile</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading profile...
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
          </Card>
        ) : profile ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex justify-center mb-6">
                    <UserAvatar
                      displayName={profile.displayName}
                      avatar={profile.avatar}
                      size="lg"
                      accentColor={accentColor}
                    />
                  </div>
                  <h2 className="text-xl mb-1">{profile.displayName}</h2>
                  <p className="text-muted-foreground mb-4">@{profile.username}</p>
                  {profile.bio ? (
                    <p className="text-muted-foreground max-w-lg mx-auto whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No bio yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2>Public Boards</h2>
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
              {boards.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No public boards yet
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {boards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      itemCount={board.mediaIds.length}
                      accentColor={accentColor}
                      onClick={() => handleBoardClick(board)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
