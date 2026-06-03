import { ALL_BOARD_NAME } from '../data/allBoard';
import { supabase } from './client';

async function findAllBoardId(userId: string): Promise<string | null> {
  const { data: systemBoards, error: systemError } = await supabase
    .from('boards')
    .select('board_id')
    .eq('user_id', userId)
    .eq('is_system', true)
    .limit(1);

  if (!systemError && systemBoards?.[0]?.board_id) {
    return systemBoards[0].board_id as string;
  }

  const { data: namedBoards, error: namedError } = await supabase
    .from('boards')
    .select('board_id')
    .eq('user_id', userId)
    .eq('name', ALL_BOARD_NAME)
    .limit(1);

  if (namedError) throw namedError;
  const namedId = namedBoards?.[0]?.board_id as string | undefined;
  if (!namedId) return null;

  await supabase
    .from('boards')
    .update({ is_system: true })
    .eq('board_id', namedId)
    .eq('user_id', userId);

  return namedId;
}

export async function ensureAllBoard(userId: string): Promise<string> {
  const existingId = await findAllBoardId(userId);
  if (existingId) return existingId;

  const { data, error } = await supabase
    .from('boards')
    .insert({
      name: ALL_BOARD_NAME,
      description: 'All media in your library',
      is_public: false,
      is_system: true,
      cover_image: null,
      media: null,
      user_id: userId,
    })
    .select('board_id')
    .single();

  if (error) throw error;
  return data.board_id as string;
}

export async function syncAllBoardMedia(userId: string): Promise<void> {
  const allBoardId = await ensureAllBoard(userId);

  const { data: mediaRows, error: mediaError } = await supabase
    .from('media')
    .select('media_id')
    .eq('user_id', userId);

  if (mediaError) throw mediaError;

  const mediaIds = (mediaRows ?? []).map((row) => row.media_id as string);

  const { error: updateError } = await supabase
    .from('boards')
    .update({ media: mediaIds })
    .eq('board_id', allBoardId)
    .eq('user_id', userId);

  if (updateError) throw updateError;
}

export async function getAllBoardId(userId: string): Promise<string | null> {
  try {
    return await findAllBoardId(userId);
  } catch {
    return null;
  }
}
