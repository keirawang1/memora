import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MEMORA_TO_MAL } from '../data/malGenres';
import { accentButtonStyle } from '../utils/accentColor';
import logoImage from '../../assets/logo.png';

const ONBOARDING_GENRES = Object.keys(MEMORA_TO_MAL);

const MIN_GENRES = 3;

interface OnboardingGenrePageProps {
  accentColor?: string;
  onContinue: (genres: string[]) => void | Promise<void>;
}

export function OnboardingGenrePage({
  accentColor = '#5C2B17',
  onContinue,
}: OnboardingGenrePageProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelected((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleContinue = async () => {
    if (selected.length < MIN_GENRES || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onContinue(selected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} alt="Memora" className="w-20 h-20 rounded-lg" />
          </div>
          <div>
            <h1 className="tracking-tight text-2xl">What do you like?</h1>
            <p className="text-muted-foreground mt-2">
              Pick at least {MIN_GENRES} genres to tune your recommendations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {ONBOARDING_GENRES.map((genre) => {
            const isSelected = selected.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                <Badge
                  variant={isSelected ? 'default' : 'outline'}
                  className="text-sm px-3 py-1.5 cursor-pointer select-none"
                  style={
                    isSelected
                      ? { backgroundColor: accentColor, borderColor: accentColor, color: '#fff' }
                      : undefined
                  }
                >
                  {genre}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <Button
            variant="accent"
            className="w-full"
            style={accentButtonStyle}
            disabled={selected.length < MIN_GENRES || isSubmitting}
            onClick={() => void handleContinue()}
          >
            {isSubmitting ? 'Saving…' : `Continue (${selected.length} selected)`}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You can change these anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
