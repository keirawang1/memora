import { useState } from 'react';
import { User, UserStats, MediaItem } from '../types/media';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Film, Tv, Sparkles, BookOpen, Book, Trophy, Activity, TrendingUp, Pencil } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { EditProfileDialog } from './EditProfileDialog';

interface ProfilePageProps {
  user: User;
  stats: UserStats;
  mediaItems: MediaItem[];
  onUpdateProfile?: (data: { displayName: string; bio: string; avatar?: string }) => void;
}

export function ProfilePage({ user, stats, mediaItems, onUpdateProfile }: ProfilePageProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  const handleSaveProfile = (data: { displayName: string; bio: string; avatar?: string }) => {
    setCurrentUser({
      ...currentUser,
      displayName: data.displayName,
      bio: data.bio,
      avatar: data.avatar,
    });
    onUpdateProfile?.(data);
  };
  // Define icon mapping for known types
  const typeIconMap: Record<string, { icon: any; color: string }> = {
    'movie': { icon: Film, color: 'text-purple-500' },
    'tv': { icon: Tv, color: 'text-blue-500' },
    'anime': { icon: Sparkles, color: 'text-pink-500' },
    'comic': { icon: BookOpen, color: 'text-orange-500' },
    'book': { icon: Book, color: 'text-green-500' },
  };

  // Get all unique media types from stats
  const allTypes = stats.customTypeCounts || {};
  const statCards = Object.entries(allTypes)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const typeConfig = typeIconMap[type.toLowerCase()] || { icon: Sparkles, color: 'text-gray-500' };
      const label = (type.toLowerCase() === 'tv' ? 'TV Show' : type.charAt(0).toUpperCase() + type.slice(1)) + (type.toLowerCase() === 'tv' ? 's' : count === 1 ? '' : 's');
      
      return {
        icon: typeConfig.icon,
        label: label,
        value: count,
        color: typeConfig.color,
      };
    });

  // Genre distribution
  const genreData = mediaItems
    .filter(item => item.status === 'watched')
    .flatMap(item => item.genre)
    .reduce((acc, genre) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const genreChartData = Object.entries(genreData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Media type distribution
  const typeColorMap: Record<string, string> = {
    'movie': '#8b5cf6',
    'tv': '#3b82f6',
    'anime': '#ec4899',
    'comic': '#f97316',
    'book': '#22c55e',
  };

  const colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#f97316', '#22c55e', '#14b8a6', '#f59e0b', '#ef4444'];

  const typeData = Object.entries(allTypes)
    .filter(([_, count]) => count > 0)
    .map(([type, count], index) => ({
      name: (type.toLowerCase() === 'tv' ? 'TV Show' : type.charAt(0).toUpperCase() + type.slice(1)) + (type.toLowerCase() === 'tv' ? 's' : count === 1 ? '' : 's'),
      value: count,
      color: typeColorMap[type.toLowerCase()] || colors[index % colors.length],
    }));

  // Monthly activity (mock data for last 6 months)
  const monthlyData = [
    { month: 'Jun', watched: 18 },
    { month: 'Jul', watched: 24 },
    { month: 'Aug', watched: 20 },
    { month: 'Sep', watched: 28 },
    { month: 'Oct', watched: 32 },
    { month: 'Nov', watched: 34 },
  ];

  // Status breakdown - filter out zero values
  const statusData = [
    {
      name: 'Completed',
      value: mediaItems.filter(i => i.status === 'watched').length,
      color: '#22c55e',
    },
    {
      name: 'In Progress',
      value: mediaItems.filter(i => i.status === 'watching').length,
      color: '#3b82f6',
    },
    {
      name: 'Want to Watch',
      value: mediaItems.filter(i => i.status === 'want-to-watch').length,
      color: '#eab308',
    },
  ].filter(item => item.value > 0);

  return (
    <>
      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        displayName={currentUser.displayName}
        bio={currentUser.bio || ''}
        avatar={currentUser.avatar}
        onSave={handleSaveProfile}
      />
      
      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Avatar className="!w-[150px] !h-[150px]">
                <AvatarImage src={currentUser.avatar} alt={currentUser.displayName} className="object-cover" />
                <AvatarFallback>{currentUser.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h1>{currentUser.displayName}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditDialogOpen(true)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-muted-foreground mb-4">@{currentUser.username}</p>
            {currentUser.bio && (
              <p className="text-muted-foreground mb-4">{currentUser.bio}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4">Media Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4">Analytics</h2>
        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Total Watched</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{stats.totalWatched}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <TrendingUp className="w-3 h-3 inline mr-1 text-green-500" />
                +12% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Favorite Genres</CardTitle>
            </CardHeader>
            <CardContent>
              {genreChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={genreChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No genre data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`type-cell-${entry.name}-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No media type data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="watched" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`status-cell-${entry.name}-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No status data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
