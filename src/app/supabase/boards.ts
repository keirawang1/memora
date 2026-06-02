import type { Board } from '../types/media';
import { supabase } from './client';

export interface CreateBoardInput {
  name: string;
  description: string;
  isPublic: boolean;
  coverImageDataUrl?: string;
}

interface DbBoard {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  cover_image: string | null;
  media: string[] | null;
  created_at: string;
  user_id: string | null;
}

function dataUrlToBytea(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return '';

  const binary = atob(base64);
  let hex = '\\x';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function byteaToDataUrl(bytea: string | null): string {
  if (!bytea) return '';

  const hex = bytea.startsWith('\\x') ? bytea.slice(2) : bytea;
  if (!hex) return '';

  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:image/jpeg;base64,${base64}`;
}

function mapDbBoardToBoard(row: DbBoard): Board {
  return {
    id: String(row.id),
    name: row.name,
    mediaIds: row.media ?? [],
    isPublic: row.is_public,
    coverImage: byteaToDataUrl(row.cover_image),
    createdAt: row.created_at.split('T')[0],
    description: row.description ?? undefined,
  };
}

export async function fetchBoards(): Promise<Board[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DbBoard[]).map(mapDbBoardToBoard);
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to create a board');
  }

  const { data, error } = await supabase
    .from('boards')
    .insert({
      name: input.name,
      description: input.description || null,
      is_public: input.isPublic,
      cover_image: input.coverImageDataUrl
        ? dataUrlToBytea(input.coverImageDataUrl)
        : null,
      media: null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return mapDbBoardToBoard(data as DbBoard);
}
