import { supabase } from './client';

export interface UserProfile {
  username: string;
  displayName: string;
  email: string;
}

export interface UserTagPreferences {
  genres: string[];
  mediaTypes: string[];
  showAllBoard: boolean;
}

interface DbUser {
  username: string;
  display_name: string;
  email: string;
  genres: string[] | null;
  media_types: string[] | null;
  show_all_board: boolean | null;
}

function mapDbUser(row: DbUser): UserProfile {
  return {
    username: row.username,
    displayName: row.display_name,
    email: row.email,
  };
}

function generateUsername(email: string): string {
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${emailPrefix}${randomNum}`.toLowerCase();
}

export async function getUserProfile(authUserId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('username, display_name, email')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDbUser(data as DbUser);
}

export async function getUserTagPreferences(
  authUserId: string,
): Promise<UserTagPreferences> {
  let { data, error } = await supabase
    .from('users')
    .select('genres, media_types, show_all_board')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) {
    const fallback = await supabase
      .from('users')
      .select('genres, media_types')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    data = fallback.data as Pick<DbUser, 'genres' | 'media_types' | 'show_all_board'> | null;
    error = null;
  }

  const row = data as Pick<DbUser, 'genres' | 'media_types' | 'show_all_board'> | null;
  return {
    genres: row?.genres ?? [],
    mediaTypes: row?.media_types ?? [],
    showAllBoard: row?.show_all_board ?? true,
  };
}

export async function updateUserShowAllBoard(
  authUserId: string,
  showAllBoard: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ show_all_board: showAllBoard })
    .eq('user_id', authUserId);

  if (error) throw error;
}

export async function updateUserGenres(
  authUserId: string,
  genres: string[],
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ genres })
    .eq('user_id', authUserId);

  if (error) throw error;
}

export async function updateUserMediaTypes(
  authUserId: string,
  mediaTypes: string[],
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ media_types: mediaTypes })
    .eq('user_id', authUserId);

  if (error) throw error;
}

export async function createUserProfile(
  authUserId: string,
  email: string,
): Promise<UserProfile> {
  const username = generateUsername(email);
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  const { data, error } = await supabase
    .from('users')
    .insert({
      user_id: authUserId,
      email,
      username,
      display_name: displayName,
      show_all_board: true,
    })
    .select('username, display_name, email')
    .single();

  if (error) throw error;
  return mapDbUser(data as DbUser);
}

export async function ensureUserProfile(
  authUserId: string,
  email: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(authUserId);
  if (existing) return existing;
  return createUserProfile(authUserId, email);
}
