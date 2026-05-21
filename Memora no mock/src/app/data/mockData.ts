/**
 * This file previously contained mock data for development.
 * All data has been removed to prepare the app for production use.
 *
 * For default data initialization, see data/defaults.ts
 */

import { MediaItem, Friend, UserStats } from '../types/media';

// Empty exports for backwards compatibility
export const mockMediaItems: MediaItem[] = [];
export const mockFriends: Friend[] = [];
export const mockUserStats: UserStats = {
  totalWatched: 0,
  moviesWatched: 0,
  tvShowsWatched: 0,
  animeWatched: 0,
  comicsRead: 0,
  booksRead: 0,
  hoursSpent: 0,
};
export const mockRecommendations: MediaItem[] = [];
export const mockFriendActivity: any[] = [];
export const mockBoards: any[] = [];
