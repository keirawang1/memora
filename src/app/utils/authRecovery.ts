export function isPasswordRecoveryUrl(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hashParams.get('type') === 'recovery') return true;

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('type') === 'recovery') return true;
  if (
    searchParams.has('code') &&
    window.location.pathname.endsWith('/reset-password')
  ) {
    return true;
  }

  return false;
}

export function getPasswordResetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

export function clearAuthParamsFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}
