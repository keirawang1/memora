import { useNavigate } from 'react-router-dom';
import lateNightFilms from '../../assets/landing/late_night_films.png';
import currentlyReading from '../../assets/landing/currently_reading.png';
import favoriteAnime from '../../assets/landing/favorite_anime.png';
import visualMasterpieces from '../../assets/landing/visual_masterpieces.png';
import classics from '../../assets/landing/classics.png';
import toRewatch from '../../assets/landing/to_rewatch.png';
import bestOfSciFi from '../../assets/landing/best_of_sci_fi.png';
import animations from '../../assets/landing/animations.png';
import { APP_ROUTES } from '../utils/appRoutes';
import { BrandMark } from './BrandMark';

type PlaceholderBoard = {
  title: string;
  count: number;
  image: string;
};

const PLACEHOLDER_BOARDS: PlaceholderBoard[] = [
  { title: 'Late Night Films', count: 24, image: lateNightFilms },
  { title: 'Currently Reading', count: 8, image: currentlyReading },
  { title: 'Favorite Anime', count: 31, image: favoriteAnime },
  { title: 'Visual Masterpieces', count: 16, image: visualMasterpieces },
  { title: 'Classics', count: 12, image: classics },
  { title: 'To Rewatch', count: 19, image: toRewatch },
  { title: 'Best of Sci Fi', count: 14, image: bestOfSciFi },
  { title: 'Animations', count: 9, image: animations },
];

function PlaceholderBoardCard({ title, count, image }: PlaceholderBoard) {
  return (
    <div className="landing-board-card shrink-0 w-[140px] sm:w-[168px]">
      <div className="aspect-square rounded-xl overflow-hidden mb-2 relative shadow-sm ring-1 ring-black/5 bg-[#E8DFD4]">
        <img src={image} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
      <p className="text-sm font-medium text-[#2A2118] line-clamp-1">{title}</p>
      <p className="text-xs text-[#2A2118]/60">
        {count} {count === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}

function BoardMarqueeRow({
  items,
  direction,
  duration,
}: {
  items: PlaceholderBoard[];
  direction: 'left' | 'right';
  duration: number;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="landing-marquee overflow-hidden">
      <div
        className={`landing-marquee-track flex gap-5 sm:gap-6 w-max ${
          direction === 'left' ? 'landing-marquee-left' : 'landing-marquee-right'
        }`}
        style={{ animationDuration: `${duration}s` }}
      >
        {doubled.map((board, i) => (
          <PlaceholderBoardCard
            key={`${board.title}-${i}`}
            title={board.title}
            count={board.count}
            image={board.image}
          />
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();

  const rowA = PLACEHOLDER_BOARDS;
  const rowB = [...PLACEHOLDER_BOARDS].reverse();
  const rowC = [...PLACEHOLDER_BOARDS.slice(3), ...PLACEHOLDER_BOARDS.slice(0, 3)];

  return (
    <div className="landing-page relative min-h-screen overflow-hidden">
      <style>{`
        .landing-page {
          --landing-ink: #1F1812;
          --landing-muted: #5C5046;
          --landing-accent: #5C2B17;
          --landing-surface: #ffffff;
          font-family: 'Sora', ui-sans-serif, system-ui, sans-serif;
          background: #ffffff;
          color: var(--landing-ink);
        }

        .landing-marquee-track {
          will-change: transform;
        }

        .landing-marquee-left {
          animation: landing-pan-left linear infinite;
        }

        .landing-marquee-right {
          animation: landing-pan-right linear infinite;
        }

        @keyframes landing-pan-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes landing-pan-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }

        @keyframes landing-fade-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .landing-hero-copy {
          animation: landing-fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
        }

        .landing-hero-ctas {
          animation: landing-fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both;
        }

        .landing-header {
          animation: landing-fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-marquee-left,
          .landing-marquee-right,
          .landing-hero-copy,
          .landing-hero-ctas,
          .landing-header {
            animation: none !important;
          }
        }
      `}</style>

      {/* Top white bar — matches app chrome */}
      <header className="landing-header relative z-20 border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2.5">
            <BrandMark size="sm" hideTaglineOnMobile />

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.signIn)}
                className="px-3 sm:px-4 py-2 text-sm font-medium text-[var(--landing-ink)]/80 hover:text-[var(--landing-ink)] transition-colors"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.signUp)}
                className="px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--landing-accent)] text-white hover:brightness-110 transition-[filter] shadow-sm"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Moving boards background */}
      <div
        className="pointer-events-none absolute inset-0 top-[3.75rem] sm:top-[4.25rem] flex flex-col justify-center gap-6 sm:gap-8 py-8"
        aria-hidden
      >
        <div className="landing-boards opacity-[0.32] sm:opacity-[0.38] brightness-[0.85] -rotate-[2deg] scale-[1.08] origin-center">
          <div className="space-y-6 sm:space-y-8">
            <BoardMarqueeRow items={rowA} direction="left" duration={48} />
            <BoardMarqueeRow items={rowB} direction="right" duration={56} />
            <BoardMarqueeRow items={rowC} direction="left" duration={52} />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/88" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(255,255,255,0.55)_65%,rgba(255,255,255,0.92)_100%)]" />
      </div>

      {/* Hero */}
      <main className="relative z-10 flex min-h-[calc(100vh-4.25rem)] flex-col items-center justify-center px-6 pb-16 text-center">
        <h1 className="landing-hero-copy text-[2.15rem] sm:text-5xl md:text-[3.4rem] font-bold tracking-tight leading-[1.1] text-[var(--landing-ink)]">
          Make Memora your 
          new digital library.
        </h1>

        <div className="landing-hero-ctas mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.signUp)}
            className="px-7 py-3 text-sm sm:text-base font-semibold rounded-lg bg-[var(--landing-accent)] text-white hover:brightness-110 transition-[filter,transform] hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            Join Memora now
          </button>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.demo)}
            className="px-7 py-3 text-sm sm:text-base font-semibold rounded-lg bg-white text-[var(--landing-ink)] border border-black/10 hover:bg-white/90 transition-[background,transform] hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            Try a demo
          </button>
        </div>
      </main>
    </div>
  );
}
