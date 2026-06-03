import { useState } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './ui/utils';
import type { Genre } from '../types/media';

interface GenreSelectDropdownProps {
  genres: string[];
  selectedGenres: Genre[];
  onChange: (genres: Genre[]) => void;
}

export function GenreSelectDropdown({
  genres,
  selectedGenres,
  onChange,
}: GenreSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const toggleGenre = (genre: Genre) => {
    if (selectedGenres.includes(genre)) {
      onChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onChange([...selectedGenres, genre]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selectedGenres.length > 0
            ? `${selectedGenres.length} genre${selectedGenres.length > 1 ? 's' : ''} selected`
            : 'Select genres...'}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="start">
        <div className="grid grid-cols-3 gap-0.5 max-h-56 overflow-y-auto overscroll-contain">
          {genres.map((genre) => {
            const isSelected = selectedGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors',
                  isSelected && 'bg-accent',
                )}
                onClick={() => toggleGenre(genre)}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{genre}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
