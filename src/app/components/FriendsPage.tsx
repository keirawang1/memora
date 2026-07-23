import { useState, useEffect, useMemo, useRef } from 'react';
import type { Friend, User } from '../types/media';
import type { PublicUser } from '../supabase/users';
import { searchUsersByUsername } from '../supabase/users';
import {
  createPost,
  createPostComment,
  deletePost,
  deletePostComment,
  fetchFeedPosts,
  fetchPostComments,
  togglePostLike,
  type FeedPost,
  type PostComment,
} from '../supabase/posts';
import { UserAvatar } from './UserAvatar';
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
  Heart,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { accentButtonStyle } from '../utils/accentColor';
import { fileToPostImageDataUrl } from '../utils/resizeImage';
import { Dialog, DialogContent } from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from './ui/utils';

type FriendsSection = 'feed' | 'manage';

interface FriendsPageProps {
  friends: Friend[];
  currentUser: User;
  accentColor?: string;
  /** Local-only mode: no Supabase calls for feed/search/posts. */
  demoMode?: boolean;
  demoPosts?: FeedPost[];
  demoSearchUsers?: User[];
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
        <AvatarFallback>
          {(user.displayName.trim().slice(0, 2) || user.username.slice(0, 2) || '??').toUpperCase()}
        </AvatarFallback>
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

function PostImagePreview({ src, alt = '' }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block rounded-lg border overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={src} alt={alt} className="w-40 h-40 object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-3xl p-2 sm:p-4 cursor-pointer"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt={alt} className="w-full max-h-[80vh] object-contain rounded-md" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PostComposer({
  currentUser,
  onPosted,
  demoMode = false,
}: {
  currentUser: User;
  onPosted: (post: FeedPost) => void;
  demoMode?: boolean;
}) {
  const [body, setBody] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      setImagePreview(await fileToPostImageDataUrl(file));
    } catch (err) {
      console.error('Failed to process image', err);
    }
  };

  const clearImage = () => setImagePreview(null);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      if (demoMode) {
        onPosted({
          id: `demo-post-${Date.now()}`,
          userId: currentUser.id,
          body: trimmed,
          imageUrl: imagePreview ?? undefined,
          createdAt: new Date().toISOString(),
          author: currentUser,
          commentCount: 0,
          likeCount: 0,
          likedByMe: false,
        });
      } else {
        const post = await createPost(currentUser.id, trimmed, imagePreview ?? undefined);
        onPosted(post);
      }
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
          <UserAvatar
            displayName={currentUser.displayName}
            avatar={currentUser.avatar}
            size="sm"
          />
          <span className="text-sm text-muted-foreground">Share with friends</span>
        </div>
        <Textarea
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        {imagePreview && (
          <div className="relative inline-block group">
            <img
              src={imagePreview}
              alt="Post attachment preview"
              className="w-32 h-32 rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
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
            variant="accent"
            size="sm"
            style={accentButtonStyle}
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
  currentUser,
  accentColor,
  demoMode = false,
  onViewProfile,
  onCommentCountChange,
  onDeleted,
  onLikeChange,
}: {
  post: FeedPost;
  currentUserId: string;
  currentUser?: User;
  accentColor?: string;
  demoMode?: boolean;
  onViewProfile: (userId: string) => void;
  onCommentCountChange: (postId: string, delta: number) => void;
  onDeleted: (postId: string) => void;
  onLikeChange: (postId: string, likeCount: number, likedByMe: boolean) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePostOpen, setDeletePostOpen] = useState(false);
  const [commentPendingDelete, setCommentPendingDelete] = useState<PostComment | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const isOwner = post.userId === currentUserId;

  const toggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && !commentsLoaded) {
      if (demoMode) {
        setComments([]);
        setCommentsLoaded(true);
        return;
      }
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
      if (demoMode) {
        const author =
          currentUser ??
          ({
            id: currentUserId,
            username: 'you',
            displayName: 'You',
          } satisfies User);
        setComments((prev) => [
          ...prev,
          {
            id: `demo-comment-${Date.now()}`,
            postId: post.id,
            userId: currentUserId,
            body: trimmed,
            createdAt: new Date().toISOString(),
            author,
          },
        ]);
        setCommentText('');
        if (!commentsLoaded) setCommentsLoaded(true);
        onCommentCountChange(post.id, 1);
      } else {
        const comment = await createPostComment(post.id, currentUserId, trimmed);
        setComments((prev) => [...prev, comment]);
        setCommentText('');
        if (!commentsLoaded) setCommentsLoaded(true);
        onCommentCountChange(post.id, 1);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const displayCount = commentsOpen && commentsLoaded ? comments.length : post.commentCount;

  const handleToggleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      if (demoMode) {
        const likedByMe = !post.likedByMe;
        onLikeChange(post.id, post.likeCount + (likedByMe ? 1 : -1), likedByMe);
      } else {
        const result = await togglePostLike(post.id);
        onLikeChange(post.id, result.likeCount, result.liked);
      }
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      if (!demoMode) {
        await deletePost(post.id);
      }
      setDeletePostOpen(false);
      onDeleted(post.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentPendingDelete || deletingComment) return;
    setDeletingComment(true);
    try {
      if (!demoMode) {
        await deletePostComment(commentPendingDelete.id);
      }
      setComments((prev) => prev.filter((c) => c.id !== commentPendingDelete.id));
      onCommentCountChange(post.id, -1);
      setCommentPendingDelete(null);
    } finally {
      setDeletingComment(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onViewProfile(post.author.id)}
            className="flex items-center gap-3 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors p-1 -m-1"
          >
            <UserAvatar
              displayName={post.author.displayName}
              avatar={post.author.avatar}
              size="sm"
              accentColor={accentColor}
            />
            <div className="min-w-0">
              <div className="text-base font-medium truncate">
                {post.author.displayName}{' '}
                <span className="text-muted-foreground font-normal">@{post.author.username}</span>
              </div>
              <div className="text-sm text-muted-foreground">{formatRelativeTime(post.createdAt)}</div>
            </div>
          </button>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">Post options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  disabled={deleting}
                  onClick={() => setDeletePostOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-base whitespace-pre-wrap">{post.body}</p>
        {post.imageUrl && <PostImagePreview src={post.imageUrl} />}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'text-base text-muted-foreground -ml-2',
              post.likedByMe && 'text-red-500 hover:text-red-600',
            )}
            disabled={liking}
            onClick={() => void handleToggleLike()}
          >
            <Heart className={cn('w-4 h-4 mr-1', post.likedByMe && 'fill-current')} />
            {post.likeCount === 0 ? 'Like' : `${post.likeCount}`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-base text-muted-foreground"
            onClick={() => void toggleComments()}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            {displayCount === 0 ? 'Comment' : `${displayCount} comment${displayCount === 1 ? '' : 's'}`}
          </Button>
        </div>
        {commentsOpen && (
          <div className="space-y-3 border-t pt-3">
            {loadingComments && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading comments...
              </div>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => onViewProfile(comment.author.id)}
                  className="shrink-0 rounded-full hover:opacity-80"
                >
                  <UserAvatar
                    displayName={comment.author.displayName}
                    avatar={comment.author.avatar}
                    size="sm"
                    accentColor={accentColor}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onViewProfile(comment.author.id)}
                      className="text-base font-medium hover:underline text-left"
                    >
                      {comment.author.displayName}{' '}
                    </button>
                    {comment.userId === currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                            <span className="sr-only">Comment options</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setCommentPendingDelete(comment)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete comment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <p className="text-base text-foreground mt-1 whitespace-pre-wrap">{comment.body}</p>
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

      <AlertDialog open={deletePostOpen} onOpenChange={setDeletePostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post and its comments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={commentPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCommentPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your comment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingComment}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingComment}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteComment();
              }}
            >
              {deletingComment ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function FriendsFeed({
  currentUser,
  accentColor,
  demoMode = false,
  initialPosts = [],
  onViewProfile,
}: {
  currentUser: User;
  accentColor?: string;
  demoMode?: boolean;
  initialPosts?: FeedPost[];
  onViewProfile: (userId: string) => void;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(() => (demoMode ? initialPosts : []));
  const [loading, setLoading] = useState(!demoMode);
  const [loadError, setLoadError] = useState(false);

  const loadPosts = async () => {
    if (demoMode) return;
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

  const handleDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleLikeChange = (postId: string, likeCount: number, likedByMe: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likeCount, likedByMe } : p,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <PostComposer currentUser={currentUser} onPosted={handlePosted} demoMode={demoMode} />
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
          currentUser={currentUser}
          accentColor={accentColor}
          demoMode={demoMode}
          onViewProfile={onViewProfile}
          onCommentCountChange={handleCommentCountChange}
          onDeleted={handleDeleted}
          onLikeChange={handleLikeChange}
        />
      ))}
    </div>
  );
}

function ManageFriends({
  friends,
  currentUserId,
  demoMode = false,
  demoSearchUsers = [],
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onUnfriend,
  onViewProfile,
}: {
  friends: Friend[];
  currentUserId: string;
  demoMode?: boolean;
  demoSearchUsers?: User[];
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

  const acceptedFriendIds = useMemo(
    () => new Set(acceptedFriends.map((f) => f.user.id)),
    [acceptedFriends],
  );

  const incomingRequestUserIds = useMemo(
    () => new Set(incomingRequests.map((f) => f.user.id)),
    [incomingRequests],
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
          if (demoMode) {
            const q = query.toLowerCase();
            const known = new Map<string, User>();
            for (const u of demoSearchUsers) known.set(u.id, u);
            for (const f of friends) known.set(f.user.id, f.user);
            const results = [...known.values()]
              .filter(
                (u) =>
                  u.id !== currentUserId &&
                  (u.username.toLowerCase().includes(q) ||
                    u.displayName.toLowerCase().includes(q)),
              )
              .map(
                (u): PublicUser => ({
                  id: u.id,
                  username: u.username,
                  displayName: u.displayName,
                  avatar: u.avatar,
                  bio: u.bio,
                }),
              );
            setSearchResults(results);
          } else {
            const results = await searchUsersByUsername(query, currentUserId);
            setSearchResults(results);
          }
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId, demoMode, demoSearchUsers, friends]);

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
          <CardTitle>Find Users</CardTitle>
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
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <UserIdentityButton
                    user={publicUserToUser(result)}
                    onViewProfile={onViewProfile}
                  />
                  {acceptedFriendIds.has(result.id) ? (
                    <Badge variant="secondary" className="shrink-0 ml-2">
                      Friends
                    </Badge>
                  ) : incomingRequestUserIds.has(result.id) ? (
                    <Badge variant="secondary" className="shrink-0 ml-2">
                      Request received
                    </Badge>
                  ) : sentRequestUserIds.has(result.id) ? (
                    <Button size="sm" className="shrink-0 ml-2" variant="secondary" disabled>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Pending
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0 ml-2"
                      onClick={() => onAddFriend(publicUserToUser(result))}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  )}
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
  accentColor,
  demoMode = false,
  demoPosts = [],
  demoSearchUsers = [],
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onUnfriend,
  onViewUserProfile,
}: FriendsPageProps) {
  const [section, setSection] = useState<FriendsSection>('feed');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-2 border-b">
        <button
          type="button"
          onClick={() => setSection('feed')}
          className={cn(
            'py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            section === 'feed'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => setSection('manage')}
          className={cn(
            'py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            section === 'manage'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Manage Friends
        </button>
      </div>

      {section === 'feed' ? (
        <FriendsFeed
          currentUser={currentUser}
          accentColor={accentColor}
          demoMode={demoMode}
          initialPosts={demoPosts}
          onViewProfile={onViewUserProfile}
        />
      ) : (
        <ManageFriends
          friends={friends}
          currentUserId={currentUser.id}
          demoMode={demoMode}
          demoSearchUsers={demoSearchUsers}
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
