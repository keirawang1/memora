import { useState } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './ui/utils';
import { formatMediaTypeLabel } from '../data/mediaOptions';

interface MediaTypeSelectDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function MediaTypeSelectDropdown({
  options,
  value,
  onChange,
  id,
}: MediaTypeSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const select = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          {formatMediaTypeLabel(value)}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="start">
        <div className="grid grid-cols-3 gap-0.5 max-h-56 overflow-y-auto overscroll-contain">
          {options.map((type) => {
            const isSelected = value === type;
            return (
              <button
                key={type}
                type="button"
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors',
                  isSelected && 'bg-accent',
                )}
                onClick={() => select(type)}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{formatMediaTypeLabel(type)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
