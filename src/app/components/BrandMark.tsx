import logoImage from '../../assets/logo.png';
import { cn } from './ui/utils';

const brandFont = "font-['Sora',ui-sans-serif,system-ui,sans-serif]";

type BrandMarkSize = 'sm' | 'md' | 'lg';

const logoSize: Record<BrandMarkSize, string> = {
  sm: 'w-10 h-10 sm:w-12 sm:h-12',
  md: 'w-14 h-14',
  lg: 'w-20 h-20 sm:w-24 sm:h-24',
};

const titleSize: Record<BrandMarkSize, string> = {
  sm: 'text-base font-medium',
  md: 'text-base font-medium',
  lg: 'text-2xl sm:text-3xl font-semibold',
};

const taglineSize: Record<BrandMarkSize, string> = {
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-sm sm:text-base',
};

interface BrandMarkProps {
  size?: BrandMarkSize;
  /** Centered stack (auth) vs horizontal row (app chrome). */
  layout?: 'row' | 'stack';
  showTagline?: boolean;
  /** Hide tagline below the `sm` breakpoint (landing header). */
  hideTaglineOnMobile?: boolean;
  /** Nudge the book logo down slightly (auth pages). */
  logoOffset?: boolean;
  className?: string;
}

/** Shared Memora logo + wordmark — matches landing header typography. */
export function BrandMark({
  size = 'sm',
  layout = 'row',
  showTagline = true,
  hideTaglineOnMobile = false,
  logoOffset = false,
  className,
}: BrandMarkProps) {
  const logo = (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center shrink-0',
        logoSize[size],
        logoOffset && 'translate-y-2',
      )}
    >
      <img src={logoImage} alt="Memora" className={cn(logoSize[size])} />
    </div>
  );

  const text = (
    <div className={cn(layout === 'stack' && 'text-center')}>
      <p className={cn(brandFont, 'tracking-tight leading-tight', titleSize[size])}>
        Memora
      </p>
      {showTagline && (
        <p
          className={cn(
            brandFont,
            'text-muted-foreground leading-snug',
            taglineSize[size],
            hideTaglineOnMobile && 'hidden sm:block',
            size === 'lg' && 'mt-1',
          )}
        >
          Your taste, redefined.
        </p>
      )}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div className={cn('flex flex-col items-center gap-4', className)}>
        {logo}
        {text}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {logo}
      {text}
    </div>
  );
}
