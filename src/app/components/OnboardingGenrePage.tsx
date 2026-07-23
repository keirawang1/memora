import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MEMORA_TO_MAL } from '../data/malGenres';
import { DEFAULT_MEDIA_TYPES, formatMediaTypeLabel } from '../data/mediaOptions';
import { accentButtonStyle } from '../utils/accentColor';
import logoImage from '../../assets/logo.png';

const ONBOARDING_GENRES = Object.keys(MEMORA_TO_MAL);
const ONBOARDING_MEDIA_TYPES = [...DEFAULT_MEDIA_TYPES];

const MIN_GENRES = 3;
const MIN_MEDIA_TYPES = 1;

interface OnboardingGenrePageProps {
  accentColor?: string;
  onContinue: (genres: string[], mediaTypes: string[]) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

export function OnboardingGenrePage({
  accentColor = '#5C2B17',
  onContinue,
  onSkip,
}: OnboardingGenrePageProps) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const canContinue =
    selectedGenres.length >= MIN_GENRES && selectedTypes.length >= MIN_MEDIA_TYPES;

  const handleContinue = async () => {
    if (!canContinue || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onContinue(selectedGenres, selectedTypes);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSkip();
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
              Pick media types and at least {MIN_GENRES} genres to tune your recommendations.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-center">Media types</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ONBOARDING_MEDIA_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
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
                    {formatMediaTypeLabel(type)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-center">Genres</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ONBOARDING_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
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
        </div>

        <div className="space-y-3">
          <Button
            variant="accent"
            className="w-full"
            style={accentButtonStyle}
            disabled={!canContinue || isSubmitting}
            onClick={() => void handleContinue()}
          >
            {isSubmitting
              ? 'Saving…'
              : `Continue (${selectedTypes.length} types · ${selectedGenres.length} genres)`}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => void handleSkip()}
          >
            Skip
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You can change these anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
