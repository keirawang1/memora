import { supabase } from './client';
import type { Friend } from '../types/media';
import { getPublicUsersByIds, type PublicUser } from './users';

const REQUESTS_COLUMN = 'requests' as const;

function parseUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === '42883' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache')
  );
}

async function assertFriendsSchema(): Promise<void> {
  const { error } = await supabase
    .from('users')
    .select(`friends, ${REQUESTS_COLUMN}`)
    .limit(1);

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new Error('Friends are not set up in the database yet. Apply the Supabase migrations.');
    }
    throw error;
  }
}

async function getCallerId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function publicUserToFriend(
  publicUser: PublicUser,
  status: Friend['status'],
  direction?: Friend['direction'],
): Friend {
  return {
    id: publicUser.id,
    user: {
      id: publicUser.id,
      username: publicUser.username,
      displayName: publicUser.displayName,
      avatar: publicUser.avatar,
      bio: publicUser.bio,
    },
    status,
    direction,
    addedAt: new Date().toISOString().split('T')[0],
  };
}

async function fetchFriendsColumns(
  authUserId: string,
): Promise<{ friends: string[]; requests: string[] }> {
  await assertFriendsSchema();

  const { data, error } = await supabase
    .from('users')
    .select(`friends, ${REQUESTS_COLUMN}`)
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { friends: [], requests: [] };

  const row = data as { friends?: unknown; requests?: unknown };
  return {
    friends: parseUuidArray(row.friends),
    requests: parseUuidArray(row.requests),
  };
}

async function fetchOutgoingRequestTargetIds(authUserId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .neq('user_id', authUserId)
    .contains(REQUESTS_COLUMN, [authUserId]);

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => row.user_id as string);
}

export async function fetchFriends(authUserId: string): Promise<Friend[]> {
  const { friends: friendIds, requests: incomingIds } = await fetchFriendsColumns(authUserId);
  const outgoingIds = await fetchOutgoingRequestTargetIds(authUserId);

  const uniqueIds = [...new Set([...friendIds, ...incomingIds, ...outgoingIds])];
  if (uniqueIds.length === 0) return [];

  const profiles = await getPublicUsersByIds(uniqueIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const result: Friend[] = [];

  for (const id of friendIds) {
    const profile = profileById.get(id);
    if (profile) result.push(publicUserToFriend(profile, 'accepted'));
  }

  for (const id of incomingIds) {
    const profile = profileById.get(id);
    if (profile) result.push(publicUserToFriend(profile, 'pending', 'incoming'));
  }

  for (const id of outgoingIds) {
    if (friendIds.includes(id) || incomingIds.includes(id)) continue;
    const profile = profileById.get(id);
    if (profile) result.push(publicUserToFriend(profile, 'pending', 'outgoing'));
  }

  return result;
}

async function sendFriendRequestDirect(targetUserId: string): Promise<void> {
  const callerId = await getCallerId();

  if (callerId === targetUserId) {
    throw new Error('Cannot add yourself');
  }

  const { data: target, error: targetError } = await supabase
    .from('users')
    .select(`friends, ${REQUESTS_COLUMN}`)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw new Error('User not found');

  const targetRow = target as { friends?: unknown; requests?: unknown };
  const targetFriends = parseUuidArray(targetRow.friends);
  const targetRequests = parseUuidArray(targetRow.requests);

  if (targetFriends.includes(callerId)) {
    throw new Error('Already friends');
  }
  if (targetRequests.includes(callerId)) {
    throw new Error('Request already pending');
  }

  const { friends: myFriends, requests: myIncoming } = await fetchFriendsColumns(callerId);
  if (myIncoming.includes(targetUserId)) {
    throw new Error('They already sent you a request — accept it from Pending Requests');
  }
  if (myFriends.includes(targetUserId)) {
    throw new Error('Already friends');
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ [REQUESTS_COLUMN]: [...targetRequests, callerId] })
    .eq('user_id', targetUserId);

  if (updateError) {
    throw new Error(updateError.message || 'Failed to send friend request');
  }
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const rpc = await supabase.rpc('send_friend_request', {
    p_target_user_id: targetUserId,
  });

  if (!rpc.error) return;

  if (isMissingSchemaError(rpc.error)) {
    await sendFriendRequestDirect(targetUserId);
    return;
  }

  throw new Error(rpc.error.message || 'Failed to send friend request');
}

function mergeFriendIds(existing: string[], ...toAdd: string[]): string[] {
  return [...new Set([...existing, ...toAdd])];
}

async function acceptFriendRequestDirect(requesterId: string): Promise<void> {
  const callerId = await getCallerId();

  const { friends: myFriends, requests: myIncoming } = await fetchFriendsColumns(callerId);
  if (!myIncoming.includes(requesterId)) {
    throw new Error('Friend request not found');
  }

  const { data: requester, error: requesterError } = await supabase
    .from('users')
    .select('friends')
    .eq('user_id', requesterId)
    .maybeSingle();

  if (requesterError) throw requesterError;
  if (!requester) throw new Error('Requester not found');

  const theirFriends = parseUuidArray((requester as { friends?: unknown }).friends);

  const { error: requesterUpdateError } = await supabase
    .from('users')
    .update({ friends: mergeFriendIds(theirFriends, callerId) })
    .eq('user_id', requesterId);

  if (requesterUpdateError) {
    throw new Error(
      requesterUpdateError.message || 'Failed to add you to the sender\'s friends list',
    );
  }

  const { error: selfError } = await supabase
    .from('users')
    .update({
      friends: mergeFriendIds(myFriends, requesterId),
      [REQUESTS_COLUMN]: myIncoming.filter((id) => id !== requesterId),
    })
    .eq('user_id', callerId);

  if (selfError) throw new Error(selfError.message || 'Failed to accept friend request');
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const rpc = await supabase.rpc('accept_friend_request', {
    p_requester_id: requesterId,
  });

  if (!rpc.error) return;

  if (isMissingSchemaError(rpc.error)) {
    await acceptFriendRequestDirect(requesterId);
    return;
  }

  const rpcMsg = (rpc.error.message ?? '').toLowerCase();
  if (rpcMsg.includes('friend request not found') || rpcMsg.includes('requester not found')) {
    throw new Error(rpc.error.message || 'Failed to accept friend request');
  }

  try {
    await acceptFriendRequestDirect(requesterId);
  } catch (directError) {
    throw new Error(
      rpc.error.message ||
        (directError instanceof Error ? directError.message : 'Failed to accept friend request'),
    );
  }
}

async function rejectFriendRequestDirect(requesterId: string): Promise<void> {
  const callerId = await getCallerId();
  const { requests: myIncoming } = await fetchFriendsColumns(callerId);

  const { error } = await supabase
    .from('users')
    .update({
      [REQUESTS_COLUMN]: myIncoming.filter((id) => id !== requesterId),
    })
    .eq('user_id', callerId);

  if (error) throw new Error(error.message || 'Failed to reject friend request');
}

export async function rejectFriendRequest(requesterId: string): Promise<void> {
  const rpc = await supabase.rpc('reject_friend_request', {
    p_requester_id: requesterId,
  });

  if (!rpc.error) return;

  if (isMissingSchemaError(rpc.error)) {
    await rejectFriendRequestDirect(requesterId);
    return;
  }

  throw new Error(rpc.error.message || 'Failed to reject friend request');
}

export async function removeFriend(friendUserId: string): Promise<void> {
  const callerId = await getCallerId();
  const { friends: myFriends } = await fetchFriendsColumns(callerId);

  if (!myFriends.includes(friendUserId)) {
    throw new Error('Not friends with this user');
  }

  const { error: selfError } = await supabase
    .from('users')
    .update({ friends: myFriends.filter((id) => id !== friendUserId) })
    .eq('user_id', callerId);

  if (selfError) {
    throw new Error(selfError.message || 'Failed to remove friend');
  }

  const { data: friendRow, error: fetchError } = await supabase
    .from('users')
    .select('friends')
    .eq('user_id', friendUserId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const theirFriends = parseUuidArray((friendRow as { friends?: unknown } | null)?.friends);
  const { error: theirError } = await supabase
    .from('users')
    .update({ friends: theirFriends.filter((id) => id !== callerId) })
    .eq('user_id', friendUserId);

  if (theirError) {
    throw new Error(theirError.message || 'Failed to update friend list');
  }
}
