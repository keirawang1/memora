import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { UserAvatar } from './UserAvatar';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationMessage,
  type AppNotification,
} from '../supabase/notifications';
import { cn } from './ui/utils';

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

interface NotificationCenterProps {
  accentColor?: string;
  onOpenFriends: () => void;
  onViewUserProfile: (userId: string) => void;
  refreshKey?: number;
}

export function NotificationCenter({
  accentColor,
  onOpenFriends,
  onViewUserProfile,
  refreshKey = 0,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUnread = useCallback(async () => {
    try {
      setUnreadCount(await fetchUnreadNotificationCount());
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await fetchNotifications());
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const interval = setInterval(() => void refreshUnread(), 45000);
    return () => clearInterval(interval);
  }, [refreshUnread, refreshKey]);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, loadNotifications, refreshKey]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void loadNotifications();
      void markAllNotificationsRead().then(() => refreshUnread());
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
        await refreshUnread();
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    onOpenFriends();
    if (n.type === 'friend_request' || n.type === 'friend_accepted') {
      onViewUserProfile(n.actorId);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-medium flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        <div className="px-4 py-3 border-b font-medium text-sm">Notifications</div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          )}
          {!loading && notifications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
          )}
          {!loading &&
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void handleNotificationClick(n)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b last:border-b-0',
                  !n.readAt && 'bg-muted/30',
                )}
              >
                <UserAvatar
                  displayName={n.actorDisplayName}
                  avatar={n.actorAvatar}
                  size="xs"
                  accentColor={accentColor}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{notificationMessage(n)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
