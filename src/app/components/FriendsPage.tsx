import { useState, useEffect, useMemo, useRef } from 'react';
import type { Friend, User } from '../types/media';
import type { PublicUser } from '../supabase/users';
import { searchUsersByUsername } from '../supabase/users';
import {
  createPost,
  createPostComment,
  fetchFeedPosts,
  fetchPostComments,
  type FeedPost,
  type PostComment,
} from '../supabase/posts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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
import {
  UserPlus,
  Check,
  X,
  Users,
  Loader2,
  UserMinus,
  MessageCircle,
  ImagePlus,
  Send,
} from 'lucide-react';
import { cn } from './ui/utils';

type FriendsSection = 'feed' | 'manage';

interface FriendsPageProps {
  friends: Friend[];
  currentUser: User;
  onAddFriend: (user: User) => void;
  onAcceptFriend: (friendId: string) => void;
  onRejectFriend: (friendId: string) => void;
  onUnfriend: (friendId: string) => void;
  onViewUserProfile: (userId: string) => void;
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

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function UserIdentityButton({
  user,
  onViewProfile,
}: {
  user: User;
  onViewProfile: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onViewProfile(user.id)}
      className="flex items-center gap-3 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors p-1 -m-1"
    >
      <Avatar>
        <AvatarImage src={user.avatar} alt={user.username} className="object-cover" />
        <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate">
          {user.displayName}{' '}
          <span className="text-muted-foreground">@{user.username}</span>
        </div>
        {user.bio && (
          <div className="text-sm text-muted-foreground truncate">{user.bio}</div>
        )}
      </div>
    </button>
  );
}

function FriendRow({
  friend,
  actions,
  onViewProfile,
}: {
  friend: Friend;
  actions?: React.ReactNode;
  onViewProfile: (userId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border gap-3">
      <UserIdentityButton user={friend.user} onViewProfile={onViewProfile} />
      {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

function PostComposer({
  currentUser,
  onPosted,
}: {
  currentUser: User;
  onPosted: (post: FeedPost) => void;
}) {
  const [body, setBody] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearImage = () => setImagePreview(null);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const post = await createPost(currentUser.id, trimmed, imagePreview ?? undefined);
      onPosted(post);
      setBody('');
      setImagePreview(null);
    } catch (err) {
      console.error('Failed to create post', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser.avatar} alt={currentUser.username} className="object-cover" />
            <AvatarFallback>{currentUser.username.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">Share with friends</span>
        </div>
        <Textarea
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        {imagePreview && (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Post attachment preview"
              className="max-h-48 rounded-lg border object-cover"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={clearImage}
            >
              Remove
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="w-4 h-4 mr-1" />
              Image
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!body.trim() || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Post
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({
  post,
  currentUserId,
  onViewProfile,
  onCommentCountChange,
}: {
  post: FeedPost;
  currentUserId: string;
  onViewProfile: (userId: string) => void;
  onCommentCountChange: (postId: string, delta: number) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const toggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && !commentsLoaded) {
      setLoadingComments(true);
      try {
        const loaded = await fetchPostComments(post.id);
        setComments(loaded);
        setCommentsLoaded(true);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || submittingComment) return;
    setSubmittingComment(true);
    try {
      const comment = await createPostComment(post.id, currentUserId, trimmed);
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      if (!commentsLoaded) setCommentsLoaded(true);
      onCommentCountChange(post.id, 1);
    } finally {
      setSubmittingComment(false);
    }
  };

  const displayCount = commentsOpen && commentsLoaded ? comments.length : post.commentCount;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onViewProfile(post.author.id)}
            className="flex items-center gap-3 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors p-1 -m-1"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author.avatar} alt={post.author.username} className="object-cover" />
              <AvatarFallback>{post.author.username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">
                {post.author.displayName}{' '}
                <span className="text-muted-foreground font-normal">@{post.author.username}</span>
              </div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(post.createdAt)}</div>
            </div>
          </button>
        </div>
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt=""
            className="w-full max-h-96 rounded-lg border object-cover"
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          onClick={() => void toggleComments()}
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          {displayCount === 0 ? 'Comment' : `${displayCount} comment${displayCount === 1 ? '' : 's'}`}
        </Button>
        {commentsOpen && (
          <div className="space-y-3 border-t pt-3">
            {loadingComments && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading comments...
              </div>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => onViewProfile(comment.author.id)}
                  className="shrink-0 rounded-full hover:opacity-80"
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage
                      src={comment.author.avatar}
                      alt={comment.author.username}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-xs">
                      {comment.author.username.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onViewProfile(comment.author.id)}
                    className="font-medium hover:underline"
                  >
                    {comment.author.displayName}
                  </button>
                  <span className="text-muted-foreground ml-1">{comment.body}</span>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleAddComment();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!commentText.trim() || submittingComment}
                onClick={() => void handleAddComment()}
              >
                {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reply'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FriendsFeed({
  currentUser,
  onViewProfile,
}: {
  currentUser: User;
  onViewProfile: (userId: string) => void;
}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadPosts = async () => {
    setLoadError(false);
    try {
      const feed = await fetchFeedPosts();
      setPosts(feed);
    } catch (err) {
      console.error('Failed to load feed', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handlePosted = (post: FeedPost) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleCommentCountChange = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: p.commentCount + delta } : p,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <PostComposer currentUser={currentUser} onPosted={handlePosted} />
      {loading && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {loadError && (
        <p className="text-sm text-center text-muted-foreground py-4">
          Could not load feed. Run the latest database migration and try again.
        </p>
      )}
      {!loading && !loadError && posts.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-8">
          No posts yet. Share something with your friends!
        </p>
      )}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUser.id}
          onViewProfile={onViewProfile}
          onCommentCountChange={handleCommentCountChange}
        />
      ))}
    </div>
  );
}

function ManageFriends({
  friends,
  currentUserId,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onUnfriend,
  onViewProfile,
}: {
  friends: Friend[];
  currentUserId: string;
  onAddFriend: (user: User) => void;
  onAcceptFriend: (friendId: string) => void;
  onRejectFriend: (friendId: string) => void;
  onUnfriend: (friendId: string) => void;
  onViewProfile: (userId: string) => void;
}) {
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
    <div className="space-y-6">
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
                      onViewProfile={onViewProfile}
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
                      onViewProfile={onViewProfile}
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
                  <UserIdentityButton
                    user={publicUserToUser(result)}
                    onViewProfile={onViewProfile}
                  />
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
                  onViewProfile={onViewProfile}
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
    </div>
  );
}

export function FriendsPage({
  friends,
  currentUser,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onUnfriend,
  onViewUserProfile,
}: FriendsPageProps) {
  const [section, setSection] = useState<FriendsSection>('feed');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="mb-2">Friends</h1>
        <p className="text-muted-foreground">
          Share updates with friends and manage your connections
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-lg border p-1 bg-muted/30">
        <button
          type="button"
          onClick={() => setSection('feed')}
          className={cn(
            'rounded-md py-2 text-sm font-medium transition-colors',
            section === 'feed'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => setSection('manage')}
          className={cn(
            'rounded-md py-2 text-sm font-medium transition-colors',
            section === 'manage'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Manage Friends
        </button>
      </div>

      {section === 'feed' ? (
        <FriendsFeed currentUser={currentUser} onViewProfile={onViewUserProfile} />
      ) : (
        <ManageFriends
          friends={friends}
          currentUserId={currentUser.id}
          onAddFriend={onAddFriend}
          onAcceptFriend={onAcceptFriend}
          onRejectFriend={onRejectFriend}
          onUnfriend={onUnfriend}
          onViewProfile={onViewUserProfile}
        />
      )}
    </div>
  );
}
