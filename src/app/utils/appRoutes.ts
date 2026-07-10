export const APP_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  onboarding: '/onboarding',
  library: '/library',
  libraryBoard: (boardId: string) => `/library/${boardId}`,
  recommendations: '/recommendations',
  friends: '/friends',
  profile: '/profile',
  user: (userId: string) => `/user/${userId}`,
} as const;

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export type AppTab = 'library' | 'recommendations' | 'friends';

export function authModeToRoute(mode: AuthMode): string {
  switch (mode) {
    case 'signin':
      return APP_ROUTES.signIn;
    case 'signup':
      return APP_ROUTES.signUp;
    case 'forgot':
      return APP_ROUTES.forgotPassword;
    case 'reset':
      return APP_ROUTES.resetPassword;
  }
}

export function getAuthModeFromPath(pathname: string): AuthMode | null {
  switch (pathname) {
    case APP_ROUTES.signIn:
      return 'signin';
    case APP_ROUTES.signUp:
      return 'signup';
    case APP_ROUTES.forgotPassword:
      return 'forgot';
    case APP_ROUTES.resetPassword:
      return 'reset';
    default:
      return null;
  }
}

export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === APP_ROUTES.signIn ||
    pathname === APP_ROUTES.signUp ||
    pathname === APP_ROUTES.forgotPassword
  );
}

export function isSignInFlowPath(pathname: string): boolean {
  return (
    pathname === APP_ROUTES.signIn ||
    pathname === APP_ROUTES.signUp ||
    pathname === APP_ROUTES.forgotPassword
  );
}

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

export function isResetPasswordPath(pathname: string): boolean {
  return pathname === APP_ROUTES.resetPassword;
}

export function isOnboardingPath(pathname: string): boolean {
  return pathname === APP_ROUTES.onboarding;
}

export function isKnownAppPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    isOnboardingPath(pathname) ||
    getTabFromPath(pathname) !== null ||
    isProfilePath(pathname) ||
    getUserIdFromPath(pathname) !== null
  );
}

export function tabToRoute(tab: AppTab): string {
  return APP_ROUTES[tab];
}
