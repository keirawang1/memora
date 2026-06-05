import type { User } from '../types/media';
import { getPublicUserProfile, getPublicUsersByIds } from './users';
import { supabase } from './client';
import { uploadPostImage } from './storage';

export interface FeedPost {
  id: string;
  userId: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  author: User;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: User;
}

interface DbPostRow {
  post_id: string;
  user_id: string;
  text: string;
  image: string | null;
  created_at: string;
}

interface DbCommentRow {
  comment_id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

function publicUserToAuthor(u: {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
}): User {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
  };
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

async function fetchAuthorsByIds(userIds: string[]): Promise<Map<string, User>> {
  const publicUsers = await getPublicUsersByIds(userIds);
  const map = new Map<string, User>();
  for (const u of publicUsers) {
    map.set(u.id, publicUserToAuthor(u));
  }
  return map;
}

async function fetchLikeStats(
  postIds: string[],
  currentUserId: string,
): Promise<{ counts: Map<string, number>; liked: Set<string> }> {
  const counts = new Map<string, number>();
  const liked = new Set<string>();
  if (postIds.length === 0) return { counts, liked };

  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id, user_id')
    .in('post_id', postIds);

  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return { counts, liked };
    }
    throw error;
  }

  for (const row of data ?? []) {
    const postId = (row as { post_id: string }).post_id;
    const userId = (row as { user_id: string }).user_id;
    counts.set(postId, (counts.get(postId) ?? 0) + 1);
    if (userId === currentUserId) liked.add(postId);
  }

  return { counts, liked };
}

export async function fetchFeedPosts(): Promise<FeedPost[]> {
  const currentUserId = await getCurrentUserId();

  const { data: posts, error } = await supabase
    .from('posts')
    .select('post_id, user_id, text, image, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (posts ?? []) as DbPostRow[];
  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.post_id);
  const { data: commentRows, error: commentError } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', postIds);

  if (commentError) throw commentError;

  const countByPost = new Map<string, number>();
  for (const c of commentRows ?? []) {
    const id = (c as { post_id: string }).post_id;
    countByPost.set(id, (countByPost.get(id) ?? 0) + 1);
  }

  const { counts: likeCounts, liked } = await fetchLikeStats(postIds, currentUserId);
  const authors = await fetchAuthorsByIds(rows.map((r) => r.user_id));

  return rows.map((row) => {
    const author = authors.get(row.user_id);
    if (!author) {
      throw new Error('Post author not found');
    }
    return {
      id: row.post_id,
      userId: row.user_id,
      body: row.text,
      imageUrl: row.image ?? undefined,
      createdAt: row.created_at,
      author,
      commentCount: countByPost.get(row.post_id) ?? 0,
      likeCount: likeCounts.get(row.post_id) ?? 0,
      likedByMe: liked.has(row.post_id),
    };
  });
}

export async function createPost(
  userId: string,
  body: string,
  imageDataUrl?: string,
): Promise<FeedPost> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('Post text is required');
  }

  let image: string | null = null;
  if (imageDataUrl?.startsWith('data:')) {
    image = await uploadPostImage(userId, imageDataUrl);
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      text: trimmed,
      image,
    })
    .select('post_id, user_id, text, image, created_at')
    .single();

  if (error) throw error;

  const row = data as DbPostRow;
  const profile = await getPublicUserProfile(userId);
  if (!profile) {
    throw new Error('Post author not found');
  }

  return {
    id: row.post_id,
    userId: row.user_id,
    body: row.text,
    imageUrl: row.image ?? undefined,
    createdAt: row.created_at,
    author: publicUserToAuthor(profile),
    commentCount: 0,
    likeCount: 0,
    likedByMe: false,
  };
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('post_id', postId);
  if (error) throw error;
}

export async function togglePostLike(
  postId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const userId = await getCurrentUserId();

  const { data: existing, error: existingError } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('post_likes').insert({
      post_id: postId,
      user_id: userId,
    });
    if (error) throw error;
  }

  const { counts, liked } = await fetchLikeStats([postId], userId);
  return {
    liked: liked.has(postId),
    likeCount: counts.get(postId) ?? 0,
  };
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('comment_id, post_id, user_id, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as DbCommentRow[];
  const authors = await fetchAuthorsByIds(rows.map((r) => r.user_id));

  return rows.map((row) => {
    const author = authors.get(row.user_id);
    if (!author) {
      throw new Error('Comment author not found');
    }
    return {
      id: row.comment_id,
      postId: row.post_id,
      userId: row.user_id,
      body: row.body,
      createdAt: row.created_at,
      author,
    };
  });
}

export async function createPostComment(
  postId: string,
  userId: string,
  body: string,
): Promise<PostComment> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('Comment text is required');
  }

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body: trimmed,
    })
    .select('comment_id, post_id, user_id, body, created_at')
    .single();

  if (error) throw error;

  const row = data as DbCommentRow;
  const profile = await getPublicUserProfile(userId);
  if (!profile) {
    throw new Error('Comment author not found');
  }

  return {
    id: row.comment_id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    author: publicUserToAuthor(profile),
  };
}
