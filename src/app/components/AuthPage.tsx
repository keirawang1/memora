import { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../supabase/client';
import { ensureUserProfile } from '../supabase/users';
import { toast } from 'sonner';
import logoImage from '../../assets/logo.png';

interface AuthPageProps {
  onAuthSuccess: (
    userId: string,
    username: string,
    displayName: string,
    email: string,
    accessToken: string,
    avatar?: string,
    bio?: string,
  ) => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const completeAuth = async (userId: string, userEmail: string, accessToken: string) => {
    const profile = await ensureUserProfile(userId, userEmail);
    onAuthSuccess(
      userId,
      profile.username,
      profile.displayName,
      profile.email,
      accessToken,
      profile.avatar,
      profile.bio,
    );
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session?.user) {
        await completeAuth(
          data.session.user.id,
          data.session.user.email ?? email,
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
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
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
          email,
          password,
        });

        if (!signInError && signInData.session?.user) {
          await createUserProfileAfterSignup(signInData.session);
          toast.success('Signed in successfully!');
          return;
        }

        const signInMsg = (signInError?.message ?? '').toLowerCase();
        if (signInMsg.includes('not confirmed')) {
          toast.success('Check your email to confirm your account, then sign in.');
          setMode('signin');
          setPassword('');
          return;
        }

        if (
          signInError &&
          (signInMsg.includes('invalid') || signInMsg.includes('credentials'))
        ) {
          toast.error(
            'An account with this email may already exist. Try signing in, or reset your password.',
          );
          return;
        }

        if (signInError) throw signInError;
      }

      if (data.session?.user) {
        await createUserProfileAfterSignup(data.session);
        toast.success('Account created successfully!');
      } else {
        toast.success('Check your email to confirm your account, then sign in.');
        setMode('signin');
        setPassword('');
      }
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      const message = error instanceof Error ? error.message : 'Failed to create account';
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
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-lg flex items-center justify-center">
              <img src={logoImage} alt="Memora" className="w-24 h-24" />
            </div>
          </div>
          <div>
            <h1 className="tracking-tight">Memora</h1>
            <p className="text-muted-foreground">Your taste, redefined.</p>
          </div>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setMode('signup');
                    setPassword('');
                  }}
                  disabled={isLoading}
                >
                  Create account
                </button>
              </p>
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
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSignUp}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setMode('signin');
                    setPassword('');
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
