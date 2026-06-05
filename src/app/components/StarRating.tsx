import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  readOnly?: boolean;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
};

export function StarRating({ value, onChange, size = 'md', readOnly = false }: StarRatingProps) {
  const starSize = sizeClasses[size];

  const handleClick = (newValue: number) => {
    if (readOnly) return;
    onChange(value === newValue ? 0 : newValue);
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.min(Math.max((value - star + 1) * 100, 0), 100);

        return (
          <div key={star} className={`relative ${starSize}`}>
            <Star className={`absolute inset-0 ${starSize} text-gray-300`} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillPercent}%` }}
            >
              <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
            </div>
            {!readOnly && (
              <>
                <button
                  type="button"
                  aria-label={`${star - 0.5} stars`}
                  className="absolute left-0 top-0 h-full w-1/2 focus:outline-none"
                  onClick={() => handleClick(star - 0.5)}
                />
                <button
                  type="button"
                  aria-label={`${star} stars`}
                  className="absolute right-0 top-0 h-full w-1/2 focus:outline-none"
                  onClick={() => handleClick(star)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function formatRating(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
