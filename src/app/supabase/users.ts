import { DEFAULT_ACCENT_COLOR } from '../data/defaults';
import type { LibrarySortPreferences, SortMode } from '../types/sort';
import { normalizeAccentColor } from '../utils/accentColor';
import { supabase } from './client';
import { getAvatarDisplayUrl, resolveAvatarUrl } from './storage';

export interface UserProfile {
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  accentColor: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
}

export interface UserTagPreferences {
  genres: string[];
  mediaTypes: string[];
  showAllBoard: boolean;
  librarySort: LibrarySortPreferences;
}

const DEFAULT_SORT_MODE: SortMode = 'alphabetical';

function parseSortMode(value: unknown): SortMode {
  if (value === 'alphabetical' || value === 'last_edited' || value === 'custom') {
    return value;
  }
  return DEFAULT_SORT_MODE;
}

function parseUuidOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

interface DbUser {
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  genres: string[] | null;
  media_types: string[] | null;
  show_all_board: boolean | null;
  accent_color: string | null;
}

type ProfileRow = Pick<
  DbUser,
  'username' | 'display_name' | 'email' | 'avatar_url' | 'bio' | 'accent_color'
>;

async function fetchUserBio(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('bio')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }

  const bio = (data as { bio?: string | null } | null)?.bio;
  return bio?.trim() ? bio.trim() : null;
}

async function fetchUserAccentColor(authUserId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('accent_color')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return DEFAULT_ACCENT_COLOR;
    throw error;
  }

  return normalizeAccentColor((data as { accent_color?: string | null } | null)?.accent_color);
}

const PROFILE_SELECT_ATTEMPTS = [
  'username, display_name, email, avatar, avatar_url, bio, accent_color',
  'username, display_name, email, avatar, avatar_url, bio',
  'username, display_name, email, avatar, avatar_url',
  'username, display_name, email, avatar, bio',
  'username, display_name, email, avatar',
  'username, display_name, email, avatar_url, bio',
  'username, display_name, email, avatar_url',
  'username, display_name, email, bio',
  'username, display_name, email',
] as const;

const PUBLIC_SELECT_ATTEMPTS = [
  'user_id, username, display_name, avatar, avatar_url, bio',
  'user_id, username, display_name, avatar, avatar_url',
  'user_id, username, display_name, avatar, bio',
  'user_id, username, display_name, avatar',
  'user_id, username, display_name, avatar_url, bio',
  'user_id, username, display_name, avatar_url',
  'user_id, username, display_name, bio',
  'user_id, username, display_name',
] as const;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('does not exist');
}

function isMissingBioColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error || !isMissingColumnError(error)) return false;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('bio');
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

function readAvatarFromRow(row: {
  avatar_url?: string | null;
  avatar?: string | null;
}): string | null {
  const fromAvatar = row.avatar?.trim();
  const fromUrl = row.avatar_url?.trim();
  return fromAvatar || fromUrl || null;
}

function mapDbUser(row: ProfileRow): UserProfile {
  const storedAvatar = row.avatar_url;
  return {
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    avatar: getAvatarDisplayUrl(storedAvatar),
    bio: row.bio ?? undefined,
    accentColor: normalizeAccentColor(row.accent_color),
  };
}

function mapPublicUser(row: {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  avatar?: string | null;
  bio?: string | null;
}): PublicUser {
  return {
    id: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatar: getAvatarDisplayUrl(readAvatarFromRow(row)),
    bio: row.bio ?? undefined,
  };
}

function toProfileRow(row: {
  username: string;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  avatar?: string | null;
  bio?: string | null;
  accent_color?: string | null;
}): ProfileRow {
  return {
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    avatar_url: readAvatarFromRow(row),
    bio: row.bio ?? null,
    accent_color: row.accent_color ?? null,
  };
}

async function fetchProfileRow(authUserId: string): Promise<ProfileRow | null> {
  for (const select of PROFILE_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .eq('user_id', authUserId)
      .maybeSingle();

    if (!error && data) {
      return toProfileRow(data as unknown as Parameters<typeof toProfileRow>[0]);
    }
    if (!error) {
      return null;
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return null;
}

/** Upload if needed, then write storage URL to users.avatar_url (or legacy users.avatar). */
export async function updateUserAvatar(
  authUserId: string,
  avatar?: string,
): Promise<string | null | undefined> {
  const resolved = await resolveAvatarUrl(authUserId, avatar);
  if (resolved === undefined) return undefined;

  const dbValue = resolved?.split('?')[0] ?? null;

  const writeAttempts: Record<string, string | null>[] = [
    { avatar: dbValue, avatar_url: dbValue },
    { avatar: dbValue },
    { avatar_url: dbValue },
  ];

  let lastError: { message?: string } | null = null;

  for (const payload of writeAttempts) {
    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    );
    const { error } = await supabase
      .from('users')
      .update(filtered)
      .eq('user_id', authUserId);

    if (!error) {
      return resolved;
    }

    if (!isMissingColumnError(error)) {
      throw new Error(error.message || 'Failed to save avatar to profile');
    }

    lastError = error;
  }

  throw new Error(lastError?.message || 'Failed to save avatar to profile');
}

function generateUsername(email: string): string {
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${emailPrefix}${randomNum}`.toLowerCase();
}

export async function getUserProfile(authUserId: string): Promise<UserProfile | null> {
  const [row, accentColor, bio] = await Promise.all([
    fetchProfileRow(authUserId),
    fetchUserAccentColor(authUserId),
    fetchUserBio(authUserId),
  ]);
  if (!row) return null;
  return mapDbUser({ ...row, accent_color: accentColor, bio: bio ?? row.bio });
}

export async function getUserAccentColor(authUserId: string): Promise<string> {
  return fetchUserAccentColor(authUserId);
}

export async function getPublicUserProfile(userId: string): Promise<PublicUser | null> {
  let profile: PublicUser | null = null;

  for (const select of PUBLIC_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      profile = mapPublicUser(data as unknown as Parameters<typeof mapPublicUser>[0]);
      break;
    }
    if (!error) {
      return null;
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  if (!profile) return null;

  try {
    const bio = await fetchUserBio(userId);
    return { ...profile, bio: bio ?? undefined };
  } catch {
    return profile;
  }
}

export async function getPublicUsersByIds(userIds: string[]): Promise<PublicUser[]> {
  if (userIds.length === 0) return [];

  for (const select of PUBLIC_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .in('user_id', userIds);

    if (!error) {
      return (data ?? []).map((row) =>
        mapPublicUser(row as unknown as Parameters<typeof mapPublicUser>[0]),
      );
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return [];
}

export async function searchUsersByUsername(
  query: string,
  excludeUserId: string,
  limit = 8,
): Promise<PublicUser[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  for (const select of PUBLIC_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .neq('user_id', excludeUserId)
      .ilike('username', `%${trimmed}%`)
      .order('username')
      .limit(limit);

    if (!error) {
      return (data ?? []).map((row) =>
        mapPublicUser(row as unknown as Parameters<typeof mapPublicUser>[0]),
      );
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return [];
}

export async function updateUserProfile(
  authUserId: string,
  data: { displayName: string; bio: string; avatar?: string },
): Promise<UserProfile> {
  if (data.avatar !== undefined) {
    await updateUserAvatar(authUserId, data.avatar);
  }

  const displayName = data.displayName.trim();
  const bio = data.bio.trim() || null;

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName, bio })
    .eq('user_id', authUserId);

  if (error) {
    if (isMissingBioColumnError(error)) {
      throw new Error(
        'Bio could not be saved. Run the latest Supabase migrations (user profile fields).',
      );
    }
    throw error;
  }

  const profile = await getUserProfile(authUserId);
  if (!profile) {
    throw new Error('Profile not found after update');
  }
  return profile;
}

export async function updateUsername(
  authUserId: string,
  username: string,
): Promise<UserProfile> {
  const normalized = username.trim().toLowerCase();

  for (const select of PROFILE_SELECT_ATTEMPTS) {
    const result = await supabase
      .from('users')
      .update({ username: normalized })
      .eq('user_id', authUserId)
      .select(select)
      .single();

    if (!result.error && result.data) {
      return mapDbUser(toProfileRow(result.data as unknown as Parameters<typeof toProfileRow>[0]));
    }

    if (result.error?.code === '23505') {
      throw new Error('Username is already taken');
    }

    if (!isMissingColumnError(result.error)) {
      throw result.error;
    }
  }

  throw new Error('Failed to update username');
}

export async function getUserTagPreferences(
  authUserId: string,
): Promise<UserTagPreferences> {
  const fullSelect =
    'genres, media_types, show_all_board, board_sort_mode, board_custom_order, media_sort_mode';

  const { data: fullData, error: fullError } = await supabase
    .from('users')
    .select(fullSelect)
    .eq('user_id', authUserId)
    .maybeSingle();

  let row: {
    genres?: string[] | null;
    media_types?: string[] | null;
    show_all_board?: boolean | null;
    board_sort_mode?: string | null;
    board_custom_order?: string[] | null;
    media_sort_mode?: string | null;
  } | null = fullData as typeof row;

  if (fullError && isMissingColumnError(fullError)) {
    const fallback = await supabase
      .from('users')
      .select('genres, media_types, show_all_board')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    row = fallback.data as typeof row;
  } else if (fullError) {
    throw fullError;
  }

  const typedRow = row as {
    genres?: string[] | null;
    media_types?: string[] | null;
    show_all_board?: boolean | null;
    board_sort_mode?: string | null;
    board_custom_order?: string[] | null;
    media_sort_mode?: string | null;
  } | null;

  return {
    genres: typedRow?.genres ?? [],
    mediaTypes: typedRow?.media_types ?? [],
    showAllBoard: typedRow?.show_all_board ?? true,
    librarySort: {
      boardSortMode: parseSortMode(typedRow?.board_sort_mode),
      boardCustomOrder: parseUuidOrder(typedRow?.board_custom_order),
      mediaSortMode: parseSortMode(typedRow?.media_sort_mode),
    },
  };
}

export async function updateUserBoardSort(
  authUserId: string,
  boardSortMode: SortMode,
  boardCustomOrder?: string[],
): Promise<void> {
  const payload: Record<string, unknown> = { board_sort_mode: boardSortMode };
  if (boardCustomOrder !== undefined) {
    payload.board_custom_order = boardCustomOrder;
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('user_id', authUserId);

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        'Sort preferences are not available yet. Run the latest Supabase migrations.',
      );
    }
    throw error;
  }
}

export async function updateUserMediaSort(
  authUserId: string,
  mediaSortMode: SortMode,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ media_sort_mode: mediaSortMode })
    .eq('user_id', authUserId);

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        'Sort preferences are not available yet. Run the latest Supabase migrations.',
      );
    }
    throw error;
  }
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

export async function updateUserAccentColor(
  authUserId: string,
  accentColor: string,
): Promise<string> {
  const normalized = normalizeAccentColor(accentColor);

  const { error } = await supabase
    .from('users')
    .update({ accent_color: normalized })
    .eq('user_id', authUserId);

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error('Accent color is not available yet. Run the latest database migration.');
    }
    throw error;
  }

  return normalized;
}

export async function createUserProfile(
  authUserId: string,
  email: string,
): Promise<UserProfile> {
  const username = generateUsername(email);
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  const insertPayload: Record<string, unknown> = {
    user_id: authUserId,
    email,
    username,
    display_name: displayName,
    show_all_board: true,
    accent_color: DEFAULT_ACCENT_COLOR,
  };

  let lastError: { code?: string; message?: string } | null = null;

  for (const select of PROFILE_SELECT_ATTEMPTS) {
    const result = await supabase
      .from('users')
      .insert(insertPayload)
      .select(select)
      .single();

    if (!result.error && result.data) {
      return mapDbUser(toProfileRow(result.data as unknown as Parameters<typeof toProfileRow>[0]));
    }

    if (!isMissingColumnError(result.error)) {
      throw result.error;
    }

    lastError = result.error;
  }

  throw lastError ?? new Error('Failed to create profile');
}

export async function ensureUserProfile(
  authUserId: string,
  email: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(authUserId);
  if (existing) return existing;

  try {
    return await createUserProfile(authUserId, email);
  } catch (error) {
    if (isUniqueViolation(error as { code?: string })) {
      const retry = await getUserProfile(authUserId);
      if (retry) return retry;
    }
    throw error;
  }
}
