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
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('code');
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  url.searchParams.delete('next');
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}
