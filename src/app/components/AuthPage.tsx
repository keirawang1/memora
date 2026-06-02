import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { getSupabaseClient } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import logoImage from 'figma:asset/5583514ac2fafeffa204feebf3730658f30d11ab.png';

interface AuthPageProps {
  onAuthSuccess: (userId: string, username: string, displayName: string, email: string, accessToken: string, avatar?: string) => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Get Supabase client singleton
  const supabase = getSupabaseClient();

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
        // Get user data from database
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-70c79af0/user/check`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ userId: data.session.user.id }),
          }
        );

        const result = await response.json();

        if (result.exists) {
          toast.success('Welcome back!');
          onAuthSuccess(
            data.session.user.id,
            result.username,
            result.displayName,
            data.session.user.email || '',
            data.session.access_token,
            result.avatar
          );
        } else {
          // User exists in auth but not in database - create auto-generated user record
          const emailPrefix = data.session.user.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          const autoUsername = `${emailPrefix}${randomNum}`.toLowerCase();
          const autoDisplayName = `${emailPrefix}${randomNum}`;

          toast.success('Welcome!');
          onAuthSuccess(
            data.session.user.id,
            autoUsername,
            autoDisplayName,
            data.session.user.email || '',
            data.session.access_token,
            undefined
          );
        }
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      toast.error(error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
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
      console.log('Creating new account for:', email);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-70c79af0/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const result = await response.json();
      console.log('Signup response status:', response.status);
      console.log('Signup response:', result);

      if (!response.ok) {
        console.error('Signup failed:', result);
        throw new Error(result.error || 'Failed to create account');
      }

      if (!result.success) {
        console.error('Signup unsuccessful:', result);
        throw new Error(result.error || 'Failed to create account');
      }

      console.log('Signup successful, now signing in...');

      // Sign in with new account
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in after signup failed:', error);
        throw error;
      }

      if (data.session?.user) {
        console.log('Sign in successful, user ID:', data.session.user.id);
        
        // Get user data from backend to verify user was created
        const checkResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-70c79af0/user/check`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ userId: data.session.user.id }),
          }
        );

        const checkResult = await checkResponse.json();
        console.log('User check result:', checkResult);

        if (checkResult.exists) {
          toast.success('Account created successfully!');
          onAuthSuccess(
            data.session.user.id,
            checkResult.username,
            checkResult.displayName,
            data.session.user.email || '',
            data.session.access_token,
            checkResult.avatar
          );
        } else {
          console.error('User was not created in database');
          toast.error('Account created but user data missing. Please try signing in.');
        }
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if user already has a username in database
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-70c79af0/user/check`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId: session.user.id }),
          }
        );

        const result = await response.json();

        if (result.exists) {
          // User already exists, log them in
          onAuthSuccess(
            session.user.id,
            result.username,
            result.displayName,
            session.user.email || '',
            session.access_token,
            result.avatar
          );
        } else {
          // Incomplete registration - sign them out and start fresh
          await supabase.auth.signOut();
          setMode('signin');
        }
      }
    };

    checkSession();
  }, []);

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
              <CardDescription>
                Enter your email and password to continue
              </CardDescription>
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
                Don't have an account?{' '}
                <button
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
              <CardDescription>
                Enter your email and password to create a new account
              </CardDescription>
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