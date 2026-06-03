import type { User } from '../types/media';

export const getDefaultBoards = () => [];

export const createDefaultUser = (): User => ({
  id: 'user-1',
  username: 'user',
  displayName: 'User',
  avatar: undefined,
  bio: '',
});
