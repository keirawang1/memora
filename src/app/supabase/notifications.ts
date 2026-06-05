import { getPublicUsersByIds } from './users';
import { supabase } from './client';

export type NotificationType =
  | 'post_like'
  | 'post_comment'
  | 'friend_request'
  | 'friend_accepted';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId: string;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatar?: string;
  postId?: string;
  commentId?: string;
  readAt?: string;
  createdAt: string;
}

interface DbNotification {
  notification_id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(limit = 40): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id, user_id, actor_id, type, post_id, comment_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as DbNotification[];
  if (rows.length === 0) return [];

  const actors = await getPublicUsersByIds(rows.map((r) => r.actor_id));
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return rows.map((row) => {
    const actor = actorById.get(row.actor_id);
    return {
      id: row.notification_id,
      type: row.type,
      actorId: row.actor_id,
      actorDisplayName: actor?.displayName ?? 'Someone',
      actorUsername: actor?.username ?? 'user',
      actorAvatar: actor?.avatar,
      postId: row.post_id ?? undefined,
      commentId: row.comment_id ?? undefined,
      readAt: row.read_at ?? undefined,
      createdAt: row.created_at,
    };
  });
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw error;
}

export function notificationMessage(n: AppNotification): string {
  const name = n.actorDisplayName;
  switch (n.type) {
    case 'post_like':
      return `${name} liked your post`;
    case 'post_comment':
      return `${name} replied to your post`;
    case 'friend_request':
      return `${name} sent you a friend request`;
    case 'friend_accepted':
      return `${name} accepted your friend request`;
    default:
      return `${name} sent you a notification`;
  }
}
