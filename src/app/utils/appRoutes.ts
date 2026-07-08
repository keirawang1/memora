export const APP_ROUTES = {
  library: '/library',
  libraryBoard: (boardId: string) => `/library/${boardId}`,
  recommendations: '/recommendations',
  friends: '/friends',
  profile: '/profile',
  user: (userId: string) => `/user/${userId}`,
} as const;

export type AppTab = 'library' | 'recommendations' | 'friends';

export function getTabFromPath(pathname: string): AppTab | null {
  if (pathname === APP_ROUTES.library || pathname.startsWith(`${APP_ROUTES.library}/`)) {
    return 'library';
  }
  if (pathname === APP_ROUTES.recommendations) return 'recommendations';
  if (pathname === APP_ROUTES.friends) return 'friends';
  return null;
}

export function getBoardIdFromPath(pathname: string): string | null {
  const prefix = `${APP_ROUTES.library}/`;
  if (!pathname.startsWith(prefix)) return null;
  const boardId = pathname.slice(prefix.length);
  return boardId.length > 0 ? boardId : null;
}

export function getUserIdFromPath(pathname: string): string | null {
  const prefix = '/user/';
  if (!pathname.startsWith(prefix)) return null;
  const userId = pathname.slice(prefix.length);
  return userId.length > 0 ? userId : null;
}

export function isProfilePath(pathname: string): boolean {
  return pathname === APP_ROUTES.profile;
}

export function isKnownAppPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    getTabFromPath(pathname) !== null ||
    isProfilePath(pathname) ||
    getUserIdFromPath(pathname) !== null
  );
}

export function tabToRoute(tab: AppTab): string {
  return APP_ROUTES[tab];
}
