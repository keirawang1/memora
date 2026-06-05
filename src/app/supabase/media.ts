import type { MediaItem } from '../types/media';
import { normalizeWatchStatus, parseGenresFromDb } from '../data/analytics';
import { excludeAllBoardFromSelection } from '../data/allBoard';
import { ensureAllBoard, syncAllBoardMedia } from './allBoardSync';
import { supabase } from './client';
import { resolveCoverImageUrl } from './storage';

export type MediaType = string;
export type WatchStatus = 'completed' | 'not-started' | 'in-progress' | 'dropped';
export type Genre = string;

export interface CreateMediaInput {
  title: string;
  type: MediaType;
  genre: Genre[];
  status: WatchStatus;
  imageUrl: string;
  gallery?: string[];
  rating?: number;
  dateStarted?: string;
  dateCompleted?: string;
  notes?: string;
  link?: string;
  boardIds?: string[];
}

export interface UpdateMediaInput {
  title?: string;
  type?: MediaType;
  genre?: Genre[];
  status?: WatchStatus;
  imageUrl?: string;
  gallery?: string[];
  rating?: number;
  dateStarted?: string;
  dateCompleted?: string;
  notes?: string;
  link?: string;
  boardIds?: string[];
}

interface DbMedia {
  media_id: string;
  title: string;
  type: string;
  status: string;
  rating: number | null;
  cover: string | null;
  board_ids: string[] | null;
  created_at: string;
  updated_at?: string | null;
  date_started: string | null;
  date_completed: string | null;
  notes: string | null;
  link: string | null;
  genres: string[] | null;
  gallery: string[] | null;
  user_id: string | null;
}

interface DbBoard {
  board_id: string;
  user_id?: string | null;
  is_public?: boolean;
  media: string[] | null;
}

function mapDbMediaToMedia(row: DbMedia): MediaItem {
  return {
    id: row.media_id,
    title: row.title,
    type: row.type,
    genre: parseGenresFromDb(row.genres),
    status: normalizeWatchStatus(row.status),
    imageUrl: row.cover ?? '',
    gallery: row.gallery ?? [],
    rating: row.rating != null ? Number(row.rating) : undefined,
    dateAdded: row.created_at,
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    dateStarted: row.date_started ?? undefined,
    dateCompleted: row.date_completed ?? undefined,
    notes: row.notes ?? undefined,
    link: row.link ?? undefined,
    boardIds: row.board_ids ?? [],
  };
}

async function appendMediaIdToBoards(
  userId: string,
  mediaId: string,
  boardIds: string[],
): Promise<void> {
  if (boardIds.length === 0) return;

  for (const boardId of boardIds) {
    const { data: board, error: fetchError } = await supabase
      .from('boards')
      .select('media')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !board) continue;

    const mediaIds = (board as DbBoard).media ?? [];
    if (mediaIds.includes(mediaId)) continue;

    const { error } = await supabase
      .from('boards')
      .update({ media: [...mediaIds, mediaId] })
      .eq('board_id', boardId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}

async function removeMediaIdFromBoards(
  userId: string,
  mediaId: string,
  boardIds: string[],
): Promise<void> {
  if (boardIds.length === 0) return;

  for (const boardId of boardIds) {
    const { data: board, error: fetchError } = await supabase
      .from('boards')
      .select('media')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !board) continue;

    const mediaIds = (board as DbBoard).media ?? [];
    if (!mediaIds.includes(mediaId)) continue;

    const { error } = await supabase
      .from('boards')
      .update({ media: mediaIds.filter((id) => id !== mediaId) })
      .eq('board_id', boardId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}

async function removeMediaIdFromAllBoards(
  userId: string,
  mediaId: string,
): Promise<void> {
  const { data: boards, error } = await supabase
    .from('boards')
    .select('board_id, media')
    .eq('user_id', userId);

  if (error) throw error;

  const boardIds = (boards as DbBoard[] | null)
    ?.filter((b) => (b.media ?? []).includes(mediaId))
    .map((b) => b.board_id) ?? [];

  await removeMediaIdFromBoards(userId, mediaId, boardIds);
}

export async function unlinkBoardFromAllMedia(boardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: rows, error } = await supabase
    .from('media')
    .select('media_id, board_ids')
    .eq('user_id', user.id);

  if (error) throw error;

  for (const row of (rows as DbMedia[] | null) ?? []) {
    const boardIds = row.board_ids ?? [];
    if (!boardIds.includes(boardId)) continue;

    const { error: updateError } = await supabase
      .from('media')
      .update({ board_ids: boardIds.filter((id) => id !== boardId) })
      .eq('media_id', row.media_id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;
  }
}

export async function fetchMediaForPublicBoard(boardId: string): Promise<MediaItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to view public boards');
  }

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('board_id, user_id, is_public, media')
    .eq('board_id', boardId)
    .eq('is_public', true)
    .maybeSingle();

  if (boardError) throw boardError;
  if (!board) return [];

  const mediaIds = (board as DbBoard).media ?? [];
  if (mediaIds.length === 0) return [];

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('user_id', (board as DbBoard).user_id as string)
    .in('media_id', mediaIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const items = (data as DbMedia[]).map(mapDbMediaToMedia);
  const order = new Map(mediaIds.map((id, index) => [id, index]));
  return items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function fetchMedia(): Promise<MediaItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DbMedia[]).map(mapDbMediaToMedia);
}

export async function createMedia(input: CreateMediaInput): Promise<MediaItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to add media');
  }

  const allBoardId = await ensureAllBoard(user.id);
  const userBoardIds = excludeAllBoardFromSelection(input.boardIds ?? [], allBoardId);
  const boardIdsForMedia = [...new Set([...userBoardIds, allBoardId])];
  const coverImageUrl = input.imageUrl
    ? await resolveCoverImageUrl(user.id, input.imageUrl)
    : null;

  const insertPayload = {
    title: input.title.trim(),
    type: input.type,
    genres: input.genre?.length ? input.genre : null,
    status: input.status,
    gallery: input.gallery?.length ? input.gallery : null,
    rating: input.rating ?? null,
    date_started: input.dateStarted || null,
    date_completed: input.dateCompleted || null,
    notes: input.notes || null,
    link: input.link || null,
    cover: coverImageUrl ?? null,
    board_ids: boardIdsForMedia,
    user_id: user.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('media')
    .insert(insertPayload)
    .select('media_id')
    .single();

  if (insertError) throw insertError;

  const mediaId = inserted.media_id as string;

  const { data: row, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('media_id', mediaId)
    .eq('user_id', user.id)
    .single();

  if (fetchError) throw fetchError;

  const media = mapDbMediaToMedia(row as DbMedia);

  try {
    await appendMediaIdToBoards(user.id, media.id, userBoardIds);
  } catch {
    // Board link can be repaired on next fetch/sync
  }

  try {
    await syncAllBoardMedia(user.id);
  } catch {
    // All board sync is best-effort
  }

  return media;
}

export async function updateMedia(
  mediaId: string,
  input: UpdateMediaInput,
): Promise<MediaItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to update media');
  }

  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.type !== undefined) payload.type = input.type;
  if (input.genre !== undefined) payload.genres = input.genre;
  if (input.status !== undefined) payload.status = input.status;
  if (input.gallery !== undefined) payload.gallery = input.gallery;
  if (input.rating !== undefined) payload.rating = input.rating;
  if (input.dateStarted !== undefined) payload.date_started = input.dateStarted || null;
  if (input.dateCompleted !== undefined) payload.date_completed = input.dateCompleted || null;
  if (input.notes !== undefined) payload.notes = input.notes || null;
  if (input.link !== undefined) payload.link = input.link || null;

  if (input.imageUrl !== undefined && input.imageUrl) {
    payload.cover = await resolveCoverImageUrl(user.id, input.imageUrl);
  }

  if (input.boardIds !== undefined) {
    const allBoardId = await ensureAllBoard(user.id);
    const userBoardIds = excludeAllBoardFromSelection(input.boardIds, allBoardId);

    const { data: existing, error: fetchError } = await supabase
      .from('media')
      .select('board_ids')
      .eq('media_id', mediaId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) throw fetchError;

    const oldBoardIds = excludeAllBoardFromSelection(
      (existing as { board_ids: string[] | null })?.board_ids ?? [],
      allBoardId,
    );
    const removed = oldBoardIds.filter((id) => !userBoardIds.includes(id));
    const added = userBoardIds.filter((id) => !oldBoardIds.includes(id));

    await removeMediaIdFromBoards(user.id, mediaId, removed);
    await appendMediaIdToBoards(user.id, mediaId, added);
    payload.board_ids = [...new Set([...userBoardIds, allBoardId])];
  }

  const { data, error } = await supabase
    .from('media')
    .update(payload)
    .eq('media_id', mediaId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  await syncAllBoardMedia(user.id);
  return mapDbMediaToMedia(data as DbMedia);
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to delete media');
  }

  await removeMediaIdFromAllBoards(user.id, mediaId);

  const { error } = await supabase
    .from('media')
    .delete()
    .eq('media_id', mediaId)
    .eq('user_id', user.id);

  if (error) throw error;

  await syncAllBoardMedia(user.id);
}
