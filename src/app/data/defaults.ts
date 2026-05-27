import type { Board, User } from '../types/media';

/**
 * Creates the default "Watchlist" board that should always exist
 */
export const createDefaultWatchlistBoard = (): Board => ({
  id: 'board-watchlist',
  name: 'Watchlist',
  mediaIds: [],
  isPublic: false,
  coverImage: '',
  createdAt: new Date().toISOString().split('T')[0],
});

/**
 * Gets the default boards that should be created on app initialization
 */
export const getDefaultBoards = (): Board[] => [
  createDefaultWatchlistBoard(),
];

/**
 * Creates a default user profile
 */
export const createDefaultUser = (): User => ({
  id: 'user-1',
  username: 'user',
  displayName: 'User',
  avatar: undefined,
  bio: '',
});
