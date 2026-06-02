import { supabase } from './client';

export interface UserProfile {
  username: string;
  displayName: string;
  email: string;
}

interface DbUser {
  username: string;
  display_name: string;
  email: string;
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
