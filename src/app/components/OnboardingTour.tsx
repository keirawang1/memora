import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { X } from 'lucide-react';

type Placement = 'top' | 'bottom' | 'center';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetId?: string;
  placement?: Placement;
  /** Allow clicks through the spotlight hole onto the target. */
  interactive?: boolean;
  /** Advance when add-board dialog closes after having been open. */
  waitForBoardClose?: boolean;
  /** Advance when add-media dialog closes after having been open. */
  waitForAddMediaClose?: boolean;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Memora',
    description:
      'This is your very own space to curate and track the media that you enjoy and share them with friends!',
    placement: 'center',
  },
  {
    id: 'new-board',
    title: 'Create a board',
    description:
      "Click New Board to make your first collection. Boards can be centered around a type of media, mood, genre, or anything you'd like!",
    targetId: 'onboarding-new-board',
    placement: 'bottom',
    interactive: true,
    waitForBoardClose: true,
  },
  {
    id: 'add-media',
    title: 'Add media',
    description:
      'Use the + button anytime to add anime, manga, movies, and more to your boards.',
    targetId: 'onboarding-add-media',
    placement: 'top',
    interactive: true,
    waitForAddMediaClose: true,
  },
  {
    id: 'settings',
    title: 'Your settings',
    description:
      'Tap your profile icon for Settings — you can change the theme and add custom genres and media types.',
    targetId: 'onboarding-account-menu',
    placement: 'bottom',
    interactive: true,
  },
  {
    id: 'done',
    title: 'Happy collecting!',
    description: 'We hope you enjoy your time here.',
    placement: 'center',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OnboardingTourProps {
  onComplete: () => void;
  addBoardDialogOpen?: boolean;
  addMediaDialogOpen?: boolean;
  /** Ensure library root is visible before the New Board / Add Media steps. */
  onEnsureLibrary?: () => void;
}

export function OnboardingTour({
  onComplete,
  addBoardDialogOpen = false,
  addMediaDialogOpen = false,
  onEnsureLibrary,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const boardWasOpenRef = useRef(false);
  const addMediaWasOpenRef = useRef(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const hideForDialog = Boolean(
    (step.waitForBoardClose && addBoardDialogOpen) ||
      (step.waitForAddMediaClose && addMediaDialogOpen),
  );
  const ensureLibraryRef = useRef(onEnsureLibrary);
  ensureLibraryRef.current = onEnsureLibrary;

  useEffect(() => {
    if (step.id === 'new-board' || step.id === 'add-media') {
      ensureLibraryRef.current?.();
    }
  }, [step.id]);

  const finish = () => {
    onComplete();
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const lastActionAtRef = useRef(0);
  const runOnce = (action: () => void) => {
    const now = Date.now();
    if (now - lastActionAtRef.current < 400) return;
    lastActionAtRef.current = now;
    action();
  };

  const handleNext = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    runOnce(goNext);
  };

  const handleSkip = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    runOnce(finish);
  };

  const stopOverlayLeak = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (!step.waitForBoardClose) {
      boardWasOpenRef.current = false;
      return;
    }
    if (addBoardDialogOpen) {
      boardWasOpenRef.current = true;
      return;
    }
    if (boardWasOpenRef.current) {
      boardWasOpenRef.current = false;
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [addBoardDialogOpen, step.waitForBoardClose]);

  useEffect(() => {
    if (!step.waitForAddMediaClose) {
      addMediaWasOpenRef.current = false;
      return;
    }
    if (addMediaDialogOpen) {
      addMediaWasOpenRef.current = true;
      return;
    }
    if (addMediaWasOpenRef.current) {
      addMediaWasOpenRef.current = false;
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [addMediaDialogOpen, step.waitForAddMediaClose]);

  useEffect(() => {
    if (!step.targetId || hideForDialog) {
      setTargetRect(null);
      return;
    }

    let misses = 0;
    const updateRect = () => {
      const el = document.getElementById(step.targetId!);
      if (!el) {
        misses += 1;
        if (misses > 5) setTargetRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        misses += 1;
        if (misses > 5) setTargetRect(null);
        return;
      }
      misses = 0;
      const next = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
      setTargetRect((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const interval = window.setInterval(updateRect, 200);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      window.clearInterval(interval);
    };
  }, [step.targetId, stepIndex, hideForDialog]);

  const padding = 8;
  const highlight = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // Enlarge the click-through region under the avatar so the account dropdown is usable.
  const clickHole =
    step.id === 'settings' && highlight
      ? {
          top: highlight.top,
          left: Math.max(0, highlight.left + highlight.width - 200),
          width: Math.min(200, window.innerWidth - Math.max(0, highlight.left + highlight.width - 200)),
          height: Math.min(220, window.innerHeight - highlight.top),
        }
      : highlight;

  const tooltipStyle = (): CSSProperties => {
    if (!highlight || step.placement === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '22rem',
      };
    }

    const gap = 12;
    if (step.placement === 'top') {
      return {
        position: 'fixed',
        bottom: window.innerHeight - highlight.top + gap,
        right: Math.max(16, window.innerWidth - highlight.left - highlight.width),
        maxWidth: '18rem',
      };
    }

    // Keep settings tooltip clear of the avatar/dropdown.
    if (step.id === 'settings') {
      return {
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '22rem',
      };
    }

    return {
      position: 'fixed',
      top: highlight.top + highlight.height + gap,
      left: Math.min(highlight.left, window.innerWidth - 288 - 16),
      maxWidth: '18rem',
    };
  };

  if (hideForDialog) {
    return null;
  }

  const allowClickThrough = Boolean(step.interactive && clickHole);

  const tourUi = (
    <div
      className={`fixed inset-0 z-[100] ${allowClickThrough ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
    >
      <style>{`
        @keyframes onboarding-spotlight-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.55);
            opacity: 1;
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
            opacity: 0.85;
          }
        }
        .onboarding-spotlight-pulse {
          animation: onboarding-spotlight-pulse 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-spotlight-pulse {
            animation: none;
          }
        }
      `}</style>
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

      {allowClickThrough && clickHole ? (
        <>
          <div
            className="absolute inset-x-0 top-0 pointer-events-auto cursor-default"
            style={{ height: Math.max(0, clickHole.top) }}
            onPointerDown={stopOverlayLeak}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 pointer-events-auto cursor-default"
            style={{
              top: clickHole.top + clickHole.height,
              height: Math.max(0, window.innerHeight - clickHole.top - clickHole.height),
            }}
            onPointerDown={stopOverlayLeak}
            aria-hidden
          />
          <div
            className="absolute left-0 pointer-events-auto cursor-default"
            style={{
              top: clickHole.top,
              width: Math.max(0, clickHole.left),
              height: clickHole.height,
            }}
            onPointerDown={stopOverlayLeak}
            aria-hidden
          />
          <div
            className="absolute right-0 pointer-events-auto cursor-default"
            style={{
              top: clickHole.top,
              width: Math.max(0, window.innerWidth - clickHole.left - clickHole.width),
              height: clickHole.height,
            }}
            onPointerDown={stopOverlayLeak}
            aria-hidden
          />
        </>
      ) : null}

      {highlight && (
        <div
          className={`absolute pointer-events-none rounded-lg ring-2 ring-white/80 ${
            step.interactive ? 'onboarding-spotlight-pulse' : ''
          }`}
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto rounded-lg border bg-background p-4 shadow-lg [touch-action:manipulation]"
        style={{ ...tooltipStyle(), zIndex: 110 }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground">
            {stepIndex + 1} of {STEPS.length}
          </p>
          {!isLast && (
            <button
              type="button"
              onClick={handleSkip}
              onTouchEnd={handleSkip}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <h3 className="font-medium mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {!isLast && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              onTouchEnd={handleSkip}
            >
              Skip
            </Button>
          )}
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={handleNext}
            onTouchEnd={handleNext}
          >
            {isLast ? 'Got it' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(tourUi, document.body);
}
