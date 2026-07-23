import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { clearAuthParamsFromUrl, isPasswordRecoveryUrl } from './authRecovery';

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function searchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function getAuthCallbackType(): string | null {
  return hashParams().get('type') ?? searchParams().get('type');
}

/** True while the URL still has Supabase auth callback params that must not be stripped by routing. */
export function hasAuthCallbackParams(): boolean {
  const hash = hashParams();
  const search = searchParams();
  return Boolean(
    search.get('code') ||
      search.get('token_hash') ||
      hash.get('access_token') ||
      hash.get('refresh_token'),
  );
}

export function isSignupConfirmCallback(): boolean {
  const type = getAuthCallbackType();
  return type === 'signup' || type === 'email';
}

export function getEmailConfirmRedirectUrl(): string {
  return `${window.location.origin}/sign-in`;
}

/** OAuth return URL — must be allow-listed in Supabase Auth redirect URLs. */
export function getOAuthRedirectUrl(): string {
  return `${window.location.origin}/sign-in`;
}

/**
 * Consume auth callback params (hash tokens, PKCE code, or token_hash) and return a session if possible.
 */
export async function settleAuthCallbackSession(): Promise<{
  session: Session | null;
  isSignupConfirm: boolean;
}> {
  if (isPasswordRecoveryUrl()) {
    return { session: null, isSignupConfirm: false };
  }

  const isSignupConfirm = isSignupConfirmCallback();
  const search = searchParams();
  const tokenHash = search.get('token_hash');
  const otpType = search.get('type') as EmailOtpType | null;

  if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error && data.session) {
      clearAuthParamsFromUrl();
      return {
        session: data.session,
        isSignupConfirm: otpType === 'signup' || otpType === 'email',
      };
    }
  }

  // Prefer the client's built-in URL detection (hash implicit + PKCE) first.
  const {
    data: { session: existing },
  } = await supabase.auth.getSession();

  if (existing) {
    if (hasAuthCallbackParams()) {
      clearAuthParamsFromUrl();
    }
    return { session: existing, isSignupConfirm };
  }

  const code = search.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      clearAuthParamsFromUrl();
      return { session: data.session, isSignupConfirm };
    }
  }

  return { session: null, isSignupConfirm };
}
