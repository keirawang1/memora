const COOLDOWN_MS = 60_000;
const STORAGE_PREFIX = 'memora_auth_email_sent:';

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`;
}

export function getAuthEmailCooldownSeconds(email: string): number {
  const raw = localStorage.getItem(storageKey(email));
  if (!raw) return 0;
  const elapsed = Date.now() - Number(raw);
  if (Number.isNaN(elapsed) || elapsed >= COOLDOWN_MS) return 0;
  return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
}

export function recordAuthEmailSent(email: string): void {
  localStorage.setItem(storageKey(email), String(Date.now()));
}

export function formatAuthEmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Failed to send email';
  const lower = message.toLowerCase();

  if (
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('email rate limit exceeded')
  ) {
    return 'Failed to send email. Please try again later.';
  }

  if (lower.includes('only request this after')) {
    const match = message.match(/after (\d+) seconds?/i);
    const seconds = match?.[1];
    return seconds
      ? `Please wait ${seconds} seconds before requesting another email.`
      : 'Please wait a minute before requesting another email.';
  }

  return message;
}
