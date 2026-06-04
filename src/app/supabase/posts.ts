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

async function fetchAuthorsByIds(userIds: string[]): Promise<Map<string, User>> {
  const publicUsers = await getPublicUsersByIds(userIds);
  const map = new Map<string, User>();
  for (const u of publicUsers) {
    map.set(u.id, publicUserToAuthor(u));
  }
  return map;
}

export async function fetchFeedPosts(): Promise<FeedPost[]> {
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
