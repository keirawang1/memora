import logoImage from '../../assets/logo.png';
import { cn } from './ui/utils';

const brandFont = "font-['Sora',ui-sans-serif,system-ui,sans-serif]";

type BrandMarkSize = 'sm' | 'md' | 'lg';

const logoSize: Record<BrandMarkSize, string> = {
  sm: 'w-10 h-10 sm:w-12 sm:h-12',
  md: 'w-14 h-14',
  lg: 'w-20 h-20 sm:w-24 sm:h-24',
};

interface BrandMarkProps {
  size?: BrandMarkSize;
  /** Centered stack (auth) vs horizontal row (app chrome). */
  layout?: 'row' | 'stack';
  showTagline?: boolean;
  /** Hide tagline below the `sm` breakpoint (landing header). */
  hideTaglineOnMobile?: boolean;
  className?: string;
}

/** Shared Memora logo + wordmark — matches landing header typography. */
export function BrandMark({
  size = 'sm',
  layout = 'row',
  showTagline = true,
  hideTaglineOnMobile = false,
  className,
}: BrandMarkProps) {
  const logo = (
    <div className={cn('rounded-lg flex items-center justify-center shrink-0', logoSize[size])}>
      <img src={logoImage} alt="Memora" className={cn(logoSize[size])} />
    </div>
  );

  const text = (
    <div className={cn(layout === 'stack' && 'text-center')}>
      <p className={cn(brandFont, 'tracking-tight text-base font-medium leading-tight')}>
        Memora
      </p>
      {showTagline && (
        <p
          className={cn(
            brandFont,
            'text-xs text-muted-foreground leading-snug',
            hideTaglineOnMobile && 'hidden sm:block',
          )}
        >
          Your taste, redefined.
        </p>
      )}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
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
