import { useState, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../supabase/client';
import { ensureUserProfile } from '../supabase/users';
import { toast } from 'sonner';
import { BrandMark } from './BrandMark';
import { getPasswordResetRedirectUrl } from '../utils/authRecovery';
import { getEmailConfirmRedirectUrl, getOAuthRedirectUrl } from '../utils/authCallback';
import {
  formatAuthEmailError,
  getAuthEmailCooldownSeconds,
  recordAuthEmailSent,
} from '../utils/authEmail';
import {
  APP_ROUTES,
  authModeToRoute,
  getAuthModeFromPath,
  type AuthMode,
} from '../utils/appRoutes';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function GoogleAuthButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-full border border-[#747775] bg-[#F8F9FA] px-4 py-2.5 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F0F1F2] disabled:pointer-events-none disabled:opacity-50"
    >
      <GoogleIcon className="size-5 shrink-0" />
      <span className="flex-1 text-center pr-5">{label}</span>
    </button>
  );
}

function AuthDivider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder,
  visible,
  onToggleVisible,
}: {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={onToggleVisible}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

interface AuthPageProps {
  initialMode?: AuthMode;
  onAuthSuccess: (
    userId: string,
    username: string,
    displayName: string,
    email: string,
    accessToken: string,
    avatar?: string,
    bio?: string,
    isNewSignup?: boolean,
  ) => void;
  onPasswordResetComplete?: () => void | Promise<void>;
}

export function AuthPage({
  initialMode = 'signin',
  onAuthSuccess,
  onPasswordResetComplete,
}: AuthPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const mode = getAuthModeFromPath(location.pathname) ?? initialMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailCooldownSeconds, setEmailCooldownSeconds] = useState(0);

  const goToAuthMode = (next: AuthMode) => {
    navigate(authModeToRoute(next));
  };

  useEffect(() => {
    if (mode !== 'forgot' || !email.trim()) {
      setEmailCooldownSeconds(0);
      return;
    }

    const updateCooldown = () => {
      setEmailCooldownSeconds(getAuthEmailCooldownSeconds(email));
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(interval);
  }, [mode, email]);

  const completeAuth = async (
    userId: string,
    userEmail: string,
    accessToken: string,
    isNewSignup = false,
  ) => {
    const profile = await ensureUserProfile(userId, userEmail);
    onAuthSuccess(
      userId,
      profile.username,
      profile.displayName,
      profile.email,
      accessToken,
      profile.avatar,
      profile.bio,
      isNewSignup,
    );
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
          queryParams: {
            // Prefer account picker; still returns the same Google email for linking.
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
      // Browser redirects to Google; session is settled on return via App auth callback.
    } catch (error: unknown) {
      console.error('Error starting Google sign-in:', error);
      const message =
        error instanceof Error ? error.message : 'Could not start Google sign-in';
      toast.error(message);
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        const code = (error as { code?: string }).code?.toLowerCase() ?? '';
        const msg = (error.message ?? '').toLowerCase();
        if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
          toast.error('Confirm your email first, then sign in.');
          return;
        }
        if (code === 'invalid_credentials' || msg.includes('invalid login')) {
          toast.error(
            'Invalid email or password. If you just signed up, use the password from your first signup — or reset it.',
          );
          return;
        }
        throw error;
      }

      if (data.session?.user) {
        await completeAuth(
          data.session.user.id,
          data.session.user.email ?? trimmedEmail,
          data.session.access_token,
        );
      }
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      const message = error instanceof Error ? error.message : 'Invalid email or password';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isExistingAccountError = (err: { code?: string; message?: string }) => {
    const code = err.code?.toLowerCase() ?? '';
    const msg = (err.message ?? '').toLowerCase();
    return (
      code === 'user_already_exists' ||
      msg.includes('already registered') ||
      msg.includes('already exists')
    );
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast.error('Please enter email and password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setEmail(trimmedEmail);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: getEmailConfirmRedirectUrl(),
        },
      });

      if (error) {
        if (isExistingAccountError(error)) {
          toast.error('An account with this email already exists. Try signing in.');
          return;
        }
        throw error;
      }

      // With email confirmation on, Supabase may return an obfuscated user (empty identities)
      // for duplicate emails. Verify by attempting sign-in instead of trusting identities alone.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (!signInError && signInData.session?.user) {
          await createUserProfileAfterSignup(signInData.session);
          toast.success('Signed in successfully!');
          return;
        }

        const signInMsg = (signInError?.message ?? '').toLowerCase();
        const signInCode = signInError?.code?.toLowerCase() ?? '';
        if (signInCode === 'email_not_confirmed' || signInMsg.includes('not confirmed')) {
          toast.success('Check your email to confirm your account, then sign in.');
          goToAuthMode('signin');
          return;
        }

        if (
          signInError &&
          (signInCode === 'invalid_credentials' ||
            signInMsg.includes('invalid') ||
            signInMsg.includes('credentials'))
        ) {
          toast.error(
            'This email is already registered. Sign in with your original password, or use Forgot password.',
          );
          goToAuthMode('signin');
          return;
        }

        if (signInError) throw signInError;
      }

      if (data.session?.user) {
        await createUserProfileAfterSignup(data.session);
        toast.success('Account created successfully!');
      } else if (data.user) {
        toast.success('Check your email to confirm your account. You will be signed in after confirming.');
        goToAuthMode('signin');
      } else {
        toast.error('Could not create account. Please try again in a minute.');
      }
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      toast.error(formatAuthEmailError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('Please enter your email');
      return;
    }

    const cooldown = getAuthEmailCooldownSeconds(trimmedEmail);
    if (cooldown > 0) {
      toast.error(`Please wait ${cooldown} seconds before requesting another reset email.`);
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) throw error;
      recordAuthEmailSent(trimmedEmail);
      setEmailCooldownSeconds(getAuthEmailCooldownSeconds(trimmedEmail));
      toast.success('Check your email for a password reset link');
      goToAuthMode('signin');
      setPassword('');
    } catch (error: unknown) {
      toast.error(formatAuthEmailError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password) {
      toast.error('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      if (onPasswordResetComplete) {
        await onPasswordResetComplete();
      } else {
        goToAuthMode('signin');
      }
      setPassword('');
      setConfirmPassword('');
      toast.success('Password updated. Sign in with your new password.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const createUserProfileAfterSignup = async (session: {
    user: { id: string; email?: string | null };
    access_token: string;
  }) => {
    await completeAuth(
      session.user.id,
      session.user.email ?? email,
      session.access_token,
      true,
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.home)}
            className="mx-auto flex rounded-lg hover:opacity-90 transition-opacity"
            aria-label="Back to Memora home"
          >
            <BrandMark size="lg" layout="stack" logoOffset />
          </button>
        </div>

        {mode === 'signin' && (
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => {
                      goToAuthMode('forgot');
                      setPassword('');
                      setShowPassword(false);
                    }}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                  disabled={isLoading}
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((prev) => !prev)}
                />
              </div>
              <Button
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <AuthDivider />
              <GoogleAuthButton
                label="Continue with Google"
                disabled={isLoading}
                onClick={() => void handleGoogleAuth()}
              />
              <p className="text-xs text-muted-foreground text-center">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    goToAuthMode('signup');
                    setPassword('');
                    setShowPassword(false);
                  }}
                  disabled={isLoading}
                >
                  Create account
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        {mode === 'forgot' && (
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <Button
                onClick={handleForgotPassword}
                disabled={isLoading || emailCooldownSeconds > 0}
                className="w-full"
              >
                {isLoading
                  ? 'Sending...'
                  : emailCooldownSeconds > 0
                    ? `Wait ${emailCooldownSeconds}s`
                    : 'Send Reset Link'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => goToAuthMode('signin')}
                  disabled={isLoading}
                >
                  Back to sign in
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        {mode === 'reset' && (
          <Card>
            <CardHeader>
              <CardTitle>Set New Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        )}

        {mode === 'signup' && (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  disabled={isLoading}
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((prev) => !prev)}
                />
              </div>
              <Button
                onClick={handleSignUp}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
              <AuthDivider />
              <GoogleAuthButton
                label="Continue with Google"
                disabled={isLoading}
                onClick={() => void handleGoogleAuth()}
              />
              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    goToAuthMode('signin');
                    setPassword('');
                    setShowPassword(false);
                  }}
                  disabled={isLoading}
                >
                  Sign in
                </button>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
