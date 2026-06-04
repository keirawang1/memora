import { useState, useEffect, useMemo } from 'react';
import type { Friend, MediaItem, User } from '../types/media';
import type { PublicUser } from '../supabase/users';
import { searchUsersByUsername } from '../supabase/users';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
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
import { UserPlus, Check, X, Users, Loader2, UserMinus } from 'lucide-react';
import { MediaCard } from './MediaCard';

interface FriendsPageProps {
  friends: Friend[];
  friendActivity: Array<{ friend: User; recentlyWatched: MediaItem[] }>;
  currentUserId: string;
  onAddFriend: (user: User) => void;
  onAcceptFriend: (friendId: string) => void;
  onRejectFriend: (friendId: string) => void;
  onUnfriend: (friendId: string) => void;
  onMediaClick: (media: MediaItem) => void;
}

function publicUserToUser(publicUser: PublicUser): User {
  return {
    id: publicUser.id,
    username: publicUser.username,
    displayName: publicUser.displayName,
    avatar: publicUser.avatar,
    bio: publicUser.bio,
  };
}

function isIncomingRequest(friend: Friend): boolean {
  return friend.status === 'pending' && friend.direction !== 'outgoing';
}

function FriendRow({
  friend,
  actions,
}: {
  friend: Friend;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar>
          <AvatarImage src={friend.user.avatar} alt={friend.user.username} className="object-cover" />
          <AvatarFallback>{friend.user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate">
            {friend.user.displayName}{' '}
            <span className="text-muted-foreground">@{friend.user.username}</span>
          </div>
          {friend.user.bio && (
            <div className="text-sm text-muted-foreground truncate">{friend.user.bio}</div>
          )}
        </div>
      </div>
      {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function FriendsPage({
  friends,
  friendActivity,
  currentUserId,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onUnfriend,
  onMediaClick,
}: FriendsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [unfriendTarget, setUnfriendTarget] = useState<Friend | null>(null);

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const incomingRequests = friends.filter(isIncomingRequest);
  const sentRequests = friends.filter(
    (f) => f.status === 'pending' && f.direction === 'outgoing',
  );

  const connectedUserIds = useMemo(
    () => new Set(friends.map((f) => f.user.id)),
    [friends],
  );

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchUsersByUsername(query, currentUserId);
          setSearchResults(results);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const addableResults = searchResults.filter((u) => !connectedUserIds.has(u.id));

  const sentRequestUserIds = useMemo(
    () => new Set(sentRequests.map((f) => f.user.id)),
    [sentRequests],
  );

  const handleConfirmUnfriend = () => {
    if (!unfriendTarget) return;
    onUnfriend(unfriendTarget.id);
    setUnfriendTarget(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="mb-2">Friends</h1>
        <p className="text-muted-foreground">
          Connect with friends and see what they&apos;re watching
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Pending Requests
            {incomingRequests.length > 0 && (
              <Badge>{incomingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomingRequests.length === 0 && sentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending requests right now.
            </p>
          ) : (
            <>
              {incomingRequests.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Received</p>
                  {incomingRequests.map((friend) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Accept @${friend.user.username}`}
                            onClick={() => onAcceptFriend(friend.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Decline @${friend.user.username}`}
                            onClick={() => onRejectFriend(friend.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
              {sentRequests.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Sent</p>
                  {sentRequests.map((friend) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      actions={<Badge variant="secondary">Awaiting response</Badge>}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Find Friends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </div>
          )}
          {!searching && searchQuery.trim() && addableResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
          {addableResults.length > 0 && (
            <div className="space-y-2">
              {addableResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar>
                      <AvatarImage src={result.avatar} alt={result.username} className="object-cover" />
                      <AvatarFallback>
                        {result.username.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate">
                        {result.displayName}{' '}
                        <span className="text-muted-foreground">@{result.username}</span>
                      </div>
                      {result.bio && (
                        <div className="text-sm text-muted-foreground truncate">{result.bio}</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 ml-2"
                    variant={sentRequestUserIds.has(result.id) ? 'secondary' : 'default'}
                    disabled={sentRequestUserIds.has(result.id)}
                    onClick={() => onAddFriend(publicUserToUser(result))}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    {sentRequestUserIds.has(result.id) ? 'Pending' : 'Add'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            My Friends
            <Badge variant="secondary">{acceptedFriends.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {acceptedFriends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No friends yet. Search for users above to add friends!
            </div>
          ) : (
            <div className="space-y-3">
              {acceptedFriends.map((friend) => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUnfriendTarget(friend)}
                    >
                      <UserMinus className="w-4 h-4 mr-1" />
                      Unfriend
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={unfriendTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnfriendTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove friend?</AlertDialogTitle>
            <AlertDialogDescription>
              {unfriendTarget
                ? `Remove @${unfriendTarget.user.username} from your friends? You can send them a new request later.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnfriend}
              className="bg-red-600 hover:bg-red-700"
            >
              Unfriend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {friendActivity.length > 0 && (
        <div>
          <h2 className="mb-4">Friend Activity</h2>
          <div className="space-y-6">
            {friendActivity.map((activity) => (
              <Card key={activity.friend.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={activity.friend.avatar}
                        alt={activity.friend.username}
                        className="object-cover"
                      />
                      <AvatarFallback>
                        {activity.friend.username.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      <span className="text-foreground">{activity.friend.displayName}</span>{' '}
                      <span className="text-muted-foreground">@{activity.friend.username}</span>
                    </span>
                    <Badge variant="secondary">Recently Added</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {activity.recentlyWatched.map((media) => (
                      <MediaCard
                        key={media.id}
                        media={media}
                        onClick={() => onMediaClick(media)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
