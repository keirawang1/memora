export type MediaType = string;
export type WatchStatus = 'completed' | 'not-started' | 'ongoing' | 'dropped';
export type Genre = string;

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  genre: Genre[];
  status: WatchStatus;
  imageUrl: string;
  gallery?: string[];
  rating?: number;
  dateAdded: string;
  dateStarted?: string;
  dateCompleted?: string;
  notes?: string;
}

export interface Board {
  id: string;
  name: string;
  mediaIds: string[];
  isPublic: boolean;
  coverImage?: string;
  createdAt: string;
  description?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  bio?: string;
}

export interface Friend {
  id: string;
  user: User;
  status: 'pending' | 'accepted' | 'rejected';
  addedAt: string;
}

export interface UserStats {
  totalWatched: number;
  moviesWatched: number;
  tvShowsWatched: number;
  animeWatched: number;
  comicsRead: number;
  booksRead: number;
  hoursSpent: number;
  customTypeCounts?: Record<string, number>;
}
