import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { accentButtonStyle } from '../utils/accentColor';
import logoImage from '../../assets/logo.png';

interface OnboardingProfilePageProps {
  initialUsername: string;
  initialDisplayName: string;
  onContinue: (data: { username: string; displayName: string }) => void | Promise<void>;
  onSkip: () => void;
}

function validateUsername(value: string): string | null {
  const clean = value.replace('@', '').trim();
  if (!clean) return 'Username is required';
  if (clean.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}

export function OnboardingProfilePage({
  initialUsername,
  initialDisplayName,
  onContinue,
  onSkip,
}: OnboardingProfilePageProps) {
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [usernameError, setUsernameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = (value: string) => {
    const clean = value.replace('@', '');
    setUsername(clean);
    const err = validateUsername(clean);
    setUsernameError(err ?? '');
  };

  const handleContinue = async () => {
    const err = validateUsername(username);
    if (err) {
      setUsernameError(err);
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onContinue({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} alt="Memora" className="w-20 h-20 rounded-lg" />
          </div>
          <div>
            <h1 className="tracking-tight text-2xl">Set up your profile</h1>
            <p className="text-muted-foreground mt-2">
              Pick a username and display name. You can change these later in Settings.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onboarding-username">Username</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-muted-foreground text-sm leading-none">@</span>
              <Input
                id="onboarding-username"
                className="border-0 shadow-none focus-visible:ring-0"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="username"
                maxLength={20}
                autoComplete="username"
              />
            </div>
            {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-display-name">Display name</Label>
            <Input
              id="onboarding-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              maxLength={40}
              autoComplete="nickname"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="accent"
            className="w-full"
            style={accentButtonStyle}
            disabled={!!usernameError || !username.trim() || isSubmitting}
            onClick={() => void handleContinue()}
          >
            {isSubmitting ? 'Saving…' : 'Continue'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onSkip} disabled={isSubmitting}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
