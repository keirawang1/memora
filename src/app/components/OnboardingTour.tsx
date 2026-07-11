import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface OnboardingStep {
  targetId: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: OnboardingStep[] = [
  {
    targetId: 'onboarding-new-board',
    title: 'Create a board',
    description:
      'Boards organize your media by theme, genre, or mood. Tap New Board to create your first collection.',
    placement: 'bottom',
  },
  {
    targetId: 'onboarding-add-media',
    title: 'Add media',
    description:
      'Use the + button anytime to add anime, manga, movies, and more to your boards.',
    placement: 'top',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    const updateRect = () => {
      const el = document.getElementById(step.targetId);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const interval = window.setInterval(updateRect, 300);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      window.clearInterval(interval);
    };
  }, [step.targetId, stepIndex]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const padding = 8;
  const highlight = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  const tooltipStyle = (): CSSProperties => {
    if (!highlight) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '20rem',
      };
    }

    const gap = 12;
    const placement = step.placement ?? 'bottom';

    if (placement === 'top') {
      return {
        position: 'fixed',
        bottom: window.innerHeight - highlight.top + gap,
        right: Math.max(16, window.innerWidth - highlight.left - highlight.width),
        maxWidth: '18rem',
      };
    }

    return {
      position: 'fixed',
      top: highlight.top + highlight.height + gap,
      left: Math.min(highlight.left, window.innerWidth - 288 - 16),
      maxWidth: '18rem',
    };
  };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="App tour">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlight && (
              <rect
                x={highlight.left}
                y={highlight.top}
                width={highlight.width}
                height={highlight.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {highlight && (
        <div
          className="absolute pointer-events-none rounded-lg ring-2 ring-white/80"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div
        className="z-[101] rounded-lg border bg-background p-4 shadow-lg"
        style={tooltipStyle()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground">
            {stepIndex + 1} of {STEPS.length}
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="font-medium mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onComplete}>
            Skip
          </Button>
          <Button variant="accent" size="sm" onClick={handleNext}>
            {isLast ? 'Got it' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
