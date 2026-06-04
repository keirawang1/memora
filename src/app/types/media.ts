export type MediaType = string;
export type WatchStatus = 'completed' | 'not-started' | 'in-progress' | 'dropped';
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
  boardIds?: string[];
}

export interface Board {
  id: string;
  name: string;
  mediaIds: string[];
  type?: string;
  isPublic: boolean;
  isSystem?: boolean;
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
  /** Incoming = someone requested you; outgoing = you requested them */
  direction?: 'incoming' | 'outgoing';
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
