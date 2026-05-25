import { useState } from 'react';
import type { Friend, MediaItem, User } from '../types/media';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { UserPlus, Check, X, Users } from 'lucide-react';
import { MediaCard } from './MediaCard';

interface FriendsPageProps {
  friends: Friend[];
  friendActivity: Array<{ friend: User; recentlyWatched: MediaItem[] }>;
  onAddFriend: (username: string) => void;
  onAcceptFriend: (friendId: string) => void;
  onRejectFriend: (friendId: string) => void;
  onMediaClick: (media: MediaItem) => void;
}

export function FriendsPage({
  friends,
  friendActivity,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onMediaClick,
}: FriendsPageProps) {
  const [newFriendUsername, setNewFriendUsername] = useState('');

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingRequests = friends.filter(f => f.status === 'pending');

  const handleAddFriend = () => {
    if (newFriendUsername.trim()) {
      onAddFriend(newFriendUsername.trim());
      setNewFriendUsername('');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="mb-2">Friends</h1>
        <p className="text-muted-foreground">
          Connect with friends and see what they're watching
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter username..."
              value={newFriendUsername}
              onChange={(e) => setNewFriendUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
            />
            <Button onClick={handleAddFriend}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Pending Requests
              <Badge>{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={friend.user.avatar} alt={friend.user.username} className="object-cover" />
                      <AvatarFallback>
                        {friend.user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div>
                        {friend.user.displayName}{' '}
                        <span className="text-muted-foreground">@{friend.user.username}</span>
                      </div>
                      {friend.user.bio && (
                        <div className="text-sm text-muted-foreground">{friend.user.bio}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAcceptFriend(friend.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectFriend(friend.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              No friends yet. Add some friends to see their activity!
            </div>
          ) : (
            <div className="space-y-3">
              {acceptedFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={friend.user.avatar} alt={friend.user.username} />
                      <AvatarFallback>
                        {friend.user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div>
                        {friend.user.displayName}{' '}
                        <span className="text-muted-foreground">@{friend.user.username}</span>
                      </div>
                      {friend.user.bio && (
                        <div className="text-sm text-muted-foreground">{friend.user.bio}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {friendActivity.length > 0 && (
        <div>
          <h2 className="mb-4">Friend Activity</h2>
          <div className="space-y-6">
            {friendActivity.map((activity) => (
              <Card key={activity.friend.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={activity.friend.avatar} alt={activity.friend.username} className="object-cover" />
                      <AvatarFallback>
                        {activity.friend.username.slice(0, 2).toUpperCase()}
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
