import type { User } from '../types/media';

export const DEFAULT_ACCENT_COLOR = '#5C2B17';

export const getDefaultBoards = () => [];

export const createDefaultUser = (): User => ({
  id: 'user-1',
  username: 'user',
  displayName: 'User',
  avatar: undefined,
  bio: '',
});
