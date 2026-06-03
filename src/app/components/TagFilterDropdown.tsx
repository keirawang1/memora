import { useState } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './ui/utils';

interface TagFilterDropdownProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  formatLabel?: (value: string) => string;
  className?: string;
}

export function TagFilterDropdown({
  options,
  selected,
  onChange,
  placeholder,
  formatLabel = (v) => v,
  className,
}: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const triggerLabel =
    selected.length > 0
      ? `${selected.length} selected`
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('shrink-0 min-w-[9rem] justify-between font-normal', className)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
        <div className="grid grid-cols-3 gap-0.5 max-h-56 overflow-y-auto overscroll-contain">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors',
                  isSelected && 'bg-accent',
                )}
                onClick={() => toggle(option)}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{formatLabel(option)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
