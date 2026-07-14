import { useState, useEffect, useMemo } from 'react';
import type { User, MediaItem } from '../types/media';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { UserAvatar } from './UserAvatar';
import { Button } from './ui/button';
import { Activity, Pencil } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EditProfileDialog } from './EditProfileDialog';
import { getUserProfile } from '../supabase/users';
import { analyticsMediaItems, computeGenreCounts, computeMediaTypeCounts } from '../data/analytics';
import { DEFAULT_ACCENT_COLOR } from '../data/defaults';
import { DEFAULT_MEDIA_TYPES, formatMediaTypeLabel } from '../data/mediaOptions';

interface ProfilePageProps {
  user: User;
  mediaItems: MediaItem[];
  accentColor?: string;
  onUpdateProfile?: (data: { displayName: string; bio: string; avatar?: string }) => void | Promise<void>;
}

const PIE_COLORS = [
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#a855f7',
  '#f97316',
  '#06b6d4',
];

function buildLastTwelveMonthsActivity(items: MediaItem[]) {
  const now = new Date();
  const buckets: { month: string; watched: number; sortKey: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: d.toLocaleString('default', { month: 'short' }),
      watched: 0,
      sortKey: d.getFullYear() * 12 + d.getMonth(),
    });
  }

  analyticsMediaItems(items).forEach((item) => {
      const dateStr = item.dateCompleted ?? item.dateAdded;
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return;
      const key = date.getFullYear() * 12 + date.getMonth();
      const bucket = buckets.find((b) => b.sortKey === key);
      if (bucket) bucket.watched += 1;
    });

  return buckets.map(({ month, watched }) => ({ month, watched }));
}

function sortMediaTypes(types: string[]): string[] {
  const order = DEFAULT_MEDIA_TYPES as readonly string[];
  return [...types].sort((a, b) => {
    const ai = order.indexOf(a.toLowerCase());
    const bi = order.indexOf(b.toLowerCase());
    const aRank = ai === -1 ? order.length : ai;
    const bRank = bi === -1 ? order.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

export function ProfilePage({ user, mediaItems, accentColor, onUpdateProfile }: ProfilePageProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    setCurrentUser({
      ...user,
      bio: user.bio ?? '',
    });
  }, [user.id, user.displayName, user.username, user.bio, user.avatar]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const profile = await getUserProfile(user.id);
        if (!cancelled && profile) {
          setCurrentUser((prev) => ({
            ...prev,
            displayName: profile.displayName,
            bio: profile.bio ?? '',
            avatar: profile.avatar,
          }));
        }
      } catch {
        // Keep props from parent if refresh fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const handleSaveProfile = async (data: { displayName: string; bio: string; avatar?: string }) => {
    await onUpdateProfile?.(data);
    setCurrentUser((prev) => ({
      ...prev,
      displayName: data.displayName.trim(),
      bio: data.bio.trim(),
    }));
  };

  const chartColor = accentColor ?? DEFAULT_ACCENT_COLOR;

  const typeChartData = useMemo(() => {
    const counts = computeMediaTypeCounts(mediaItems);
    return sortMediaTypes(Object.keys(counts).filter((t) => counts[t] > 0)).map((type) => ({
      name: formatMediaTypeLabel(type),
      value: counts[type],
    }));
  }, [mediaItems]);

  const genreChartData = useMemo(() => computeGenreCounts(mediaItems), [mediaItems]);

  const monthlyData = useMemo(() => buildLastTwelveMonthsActivity(mediaItems), [mediaItems]);
  const typeMax = Math.max(1, ...typeChartData.map((d) => d.value));

  return (
    <>
      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        displayName={currentUser.displayName}
        bio={currentUser.bio || ''}
        avatar={currentUser.avatar}
        accentColor={accentColor}
        onSave={handleSaveProfile}
      />

      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <UserAvatar
                  displayName={currentUser.displayName}
                  avatar={currentUser.avatar}
                  size="lg"
                  accentColor={accentColor}
                />
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <h1>{currentUser.displayName}</h1>
                <Button
                  variant="accentGhost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-muted-foreground mb-4">@{currentUser.username}</p>
              {currentUser.bio ? (
                <p className="text-muted-foreground mb-4 max-w-lg mx-auto whitespace-pre-wrap">
                  {currentUser.bio}
                </p>
              ) : (
                <p className="text-muted-foreground mb-4 italic">No bio yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-4">Analytics</h2>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Genres</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                {genreChartData.length > 0 ? (
                  <div className="w-full h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genreChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          label={({ name, percent }) =>
                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          {genreChartData.map((_, index) => (
                            <Cell
                              key={genreChartData[index].name}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip labelStyle={{ color: '#000' }} itemStyle={{ color: '#000' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No genres in your library yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Media Types</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                {typeChartData.length > 0 ? (
                  <ul className="space-y-3">
                    {typeChartData.map(({ name, value }) => (
                      <li key={name}>
                        <div className="flex items-center justify-between gap-3 mb-1.5 text-sm">
                          <span className="font-medium truncate">{name}</span>
                          <span className="text-muted-foreground tabular-nums shrink-0">{value}</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${(value / typeMax) * 100}%`,
                              backgroundColor: chartColor,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No media types in your library yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Monthly Activity</CardTitle>
                <Activity className="w-4 h-4" style={{ color: chartColor }} />
              </CardHeader>
              <CardContent className="min-w-0">
                <div className="w-full h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} width={32} />
                      <Tooltip labelStyle={{ color: '#000' }} itemStyle={{ color: '#000' }} />
                      <Line
                        type="monotone"
                        dataKey="watched"
                        name="Activity"
                        stroke={chartColor}
                        strokeWidth={2}
                        dot={{ r: 4, fill: chartColor }}
                        activeDot={{ r: 6, fill: chartColor }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
