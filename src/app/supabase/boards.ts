import type { Board, MediaItem } from '../types/media';
import { ALL_BOARD_NAME, isAllBoard, sortBoardsWithAllFirst } from '../data/allBoard';
import { ensureAllBoard, getAllBoardId } from './allBoardSync';
import { fetchMedia, unlinkBoardFromAllMedia } from './media';
import { supabase } from './client';
import { deleteBoardCoverFromStorage, resolveCoverImageUrl } from './storage';

export type CreateBoardInput = BoardInput;

export interface BoardInput {
  name: string;
  description: string;
  isPublic: boolean;
  type?: string;
  coverImageDataUrl?: string;
}

interface DbBoard {
  board_id: string;
  name: string;
  description: string | null;
  type?: string | null;
  is_public: boolean;
  is_system?: boolean;
  cover_image: string | null;
  media: string[] | null;
  created_at: string;
  updated_at?: string | null;
  user_id: string | null;
}

const BOARD_SELECT =
  'board_id, name, description, type, is_public, is_system, cover_image, media, created_at, updated_at, user_id';

const BOARD_SELECT_FALLBACK =
  'board_id, name, description, is_public, cover_image, media, created_at, user_id';

function mapDbBoardToBoard(row: DbBoard): Board {
  return {
    id: row.board_id,
    name: row.name,
    mediaIds: row.media ?? [],
    type: row.type ?? undefined,
    isPublic: row.is_public,
    isSystem: row.is_system === true || row.name === ALL_BOARD_NAME,
    coverImage: row.cover_image ?? '',
    createdAt: row.created_at?.split('T')[0] ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    description: row.description ?? undefined,
  };
}

export async function updateBoardMediaOrder(
  boardId: string,
  mediaIds: string[],
): Promise<Board> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to reorder media');
  }

  const { data, error } = await supabase
    .from('boards')
    .update({ media: mediaIds })
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .select(BOARD_SELECT)
    .single();

  if (error) {
    const fallback = await supabase
      .from('boards')
      .update({ media: mediaIds })
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .select(BOARD_SELECT_FALLBACK)
      .single();

    if (fallback.error) throw fallback.error;
    return mapDbBoardToBoard(fallback.data as DbBoard);
  }

  return mapDbBoardToBoard(data as DbBoard);
}

async function fetchBoardRows(userId: string): Promise<DbBoard[]> {
  const primary = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!primary.error) {
    return (primary.data as DbBoard[]) ?? [];
  }

  const fallback = await supabase
    .from('boards')
    .select(BOARD_SELECT_FALLBACK)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (fallback.error) throw fallback.error;
  return (fallback.data as DbBoard[]) ?? [];
}

function applyAllBoardMediaIds(boards: Board[], allMediaIds: string[]): Board[] {
  return boards.map((board) =>
    isAllBoard(board) ? { ...board, mediaIds: allMediaIds } : board,
  );
}

function buildBoardList(rows: DbBoard[], allMediaIds: string[]): Board[] {
  let boards = rows.map(mapDbBoardToBoard);
  boards = applyAllBoardMediaIds(boards, allMediaIds);
  return sortBoardsWithAllFirst(boards);
}

/** Parallel library load — one round-trip each for media + boards. */
export async function fetchLibrary(userId: string): Promise<{
  media: MediaItem[];
  boards: Board[];
  mediaError?: Error;
}> {
  const [mediaResult, boardResult] = await Promise.allSettled([
    fetchMedia(userId),
    fetchBoardRows(userId),
  ]);

  const media =
    mediaResult.status === 'fulfilled' ? mediaResult.value : [];
  const rows =
    boardResult.status === 'fulfilled' ? boardResult.value : [];

  if (boardResult.status === 'rejected') {
    throw boardResult.reason instanceof Error
      ? boardResult.reason
      : new Error('Failed to load boards');
  }

  let boards = buildBoardList(rows, media.map((m) => m.id));

  if (!boards.some(isAllBoard)) {
    try {
      const allBoardId = await ensureAllBoard(userId);
      boards = sortBoardsWithAllFirst([
        {
          id: allBoardId,
          name: ALL_BOARD_NAME,
          mediaIds: media.map((m) => m.id),
          isPublic: false,
          isSystem: true,
          coverImage: '',
          createdAt: new Date().toISOString().split('T')[0],
          description: '',
        },
        ...boards.filter((b) => !isAllBoard(b)),
      ]);
    } catch {
      // No All board available
    }
  }

  return {
    media,
    boards,
    mediaError:
      mediaResult.status === 'rejected'
        ? mediaResult.reason instanceof Error
          ? mediaResult.reason
          : new Error('Failed to load media')
        : undefined,
  };
}

export async function fetchBoards(
  mediaItems?: MediaItem[],
  userId?: string,
): Promise<Board[]> {
  const resolvedUserId =
    userId ??
    (await supabase.auth.getSession()).data.session?.user?.id;
  if (!resolvedUserId) return [];

  const rows = await fetchBoardRows(resolvedUserId);

  const allMediaIds =
    mediaItems?.map((m) => m.id) ??
    (
      await supabase
        .from('media')
        .select('media_id')
        .eq('user_id', resolvedUserId)
    ).data?.map((row) => row.media_id as string) ??
    [];

  let boards = buildBoardList(rows, allMediaIds);

  if (!boards.some(isAllBoard)) {
    try {
      const allBoardId = await ensureAllBoard(resolvedUserId);
      boards = sortBoardsWithAllFirst([
        {
          id: allBoardId,
          name: ALL_BOARD_NAME,
          mediaIds: allMediaIds,
          isPublic: false,
          isSystem: true,
          coverImage: '',
          createdAt: new Date().toISOString().split('T')[0],
          description: '',
        },
        ...boards.filter((b) => !isAllBoard(b)),
      ]);
    } catch {
      // No All board available
    }
  }

  return boards;
}

export async function fetchPublicBoardsForUser(userId: string): Promise<Board[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to view public boards');
  }

  const primary = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: true });

  let rows: DbBoard[] = [];

  if (!primary.error) {
    rows = (primary.data as DbBoard[]) ?? [];
  } else {
    const fallback = await supabase
      .from('boards')
      .select(BOARD_SELECT_FALLBACK)
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: true });

    if (fallback.error) throw fallback.error;
    rows = (fallback.data as DbBoard[]) ?? [];
  }

  return rows
    .map(mapDbBoardToBoard)
    .filter((board) => !isAllBoard(board));
}

export async function createBoard(input: BoardInput): Promise<Board> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to create a board');
  }

  if (input.name.trim().toLowerCase() === ALL_BOARD_NAME.toLowerCase()) {
    throw new Error(`"${ALL_BOARD_NAME}" is reserved for the system board`);
  }

  const coverImageUrl = input.coverImageDataUrl
    ? await resolveCoverImageUrl(user.id, input.coverImageDataUrl)
    : null;

  const rowPayload = {
    name: input.name.trim(),
    description: input.description || null,
    type: input.type?.trim() || null,
    is_public: input.isPublic,
    is_system: false,
    cover_image: coverImageUrl,
    media: null,
    user_id: user.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('boards')
    .insert(rowPayload)
    .select('board_id')
    .single();

  if (insertError) throw insertError;

  const boardId = inserted.board_id as string;

  const primary = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .single();

  if (!primary.error && primary.data) {
    return mapDbBoardToBoard(primary.data as DbBoard);
  }

  const fallback = await supabase
    .from('boards')
    .select(BOARD_SELECT_FALLBACK)
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .single();

  if (fallback.error) throw fallback.error;
  return mapDbBoardToBoard(fallback.data as DbBoard);
}

export async function updateBoard(
  boardId: string,
  input: Partial<BoardInput>,
): Promise<Board> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to update a board');
  }

  const { data: existingBoard, error: existingError } = await supabase
    .from('boards')
    .select('is_system, name')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  const isSystemAllBoard =
    existingBoard?.is_system === true || existingBoard?.name === ALL_BOARD_NAME;

  if (isSystemAllBoard) {
    const hasDisallowedUpdates =
      input.name !== undefined ||
      input.description !== undefined ||
      input.type !== undefined ||
      input.isPublic !== undefined;

    if (hasDisallowedUpdates) {
      throw new Error('Only the cover image can be changed for the All board');
    }

    if (!input.coverImageDataUrl) {
      throw new Error('Choose a cover image to save');
    }

    const { data: existing } = await supabase
      .from('boards')
      .select('cover_image')
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .single();

    const coverImage = await resolveCoverImageUrl(user.id, input.coverImageDataUrl);

    if (existing?.cover_image && existing.cover_image !== coverImage) {
      await deleteBoardCoverFromStorage(existing.cover_image);
    }

    const { data, error } = await supabase
      .from('boards')
      .update({ cover_image: coverImage })
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .select(BOARD_SELECT)
      .single();

    if (error) throw error;
    return mapDbBoardToBoard(data as DbBoard);
  }

  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.type !== undefined) payload.type = input.type?.trim() || null;
  if (input.isPublic !== undefined) payload.is_public = input.isPublic;

  if (input.coverImageDataUrl) {
    const { data: existing } = await supabase
      .from('boards')
      .select('cover_image')
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .single();

    payload.cover_image = await resolveCoverImageUrl(
      user.id,
      input.coverImageDataUrl,
    );

    if (
      existing?.cover_image &&
      existing.cover_image !== payload.cover_image
    ) {
      await deleteBoardCoverFromStorage(existing.cover_image);
    }
  }

  const { data, error } = await supabase
    .from('boards')
    .update(payload)
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .select(BOARD_SELECT)
    .single();

  if (error) throw error;
  return mapDbBoardToBoard(data as DbBoard);
}


export async function deleteBoard(boardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to delete a board');

  const allBoardId = await getAllBoardId(user.id);
  if (allBoardId && boardId === allBoardId) {
    throw new Error('The All board cannot be deleted');
  }

  const { data: board, error: fetchError } = await supabase
    .from('boards')
    .select('cover_image, is_system, name')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .single();

  if (fetchError) throw fetchError;

  if (board?.is_system || board?.name === ALL_BOARD_NAME) {
    throw new Error('The All board cannot be deleted');
  }

  if (board?.cover_image) {
    await deleteBoardCoverFromStorage(board.cover_image);
  }

  await unlinkBoardFromAllMedia(boardId);

  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', user.id);

  if (error) throw error;
}
