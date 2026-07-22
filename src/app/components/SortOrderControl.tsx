import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  BOARD_SORT_MODES,
  DEFAULT_SORT_DIRECTION,
  SORT_MODE_LABELS,
  type SortDirection,
  type SortMode,
} from '../types/sort';
import { cn } from './ui/utils';

interface SortOrderControlProps {
  mode: SortMode;
  direction: SortDirection;
  onChange: (mode: SortMode, direction: SortDirection) => void;
  modes?: SortMode[];
}

export function SortOrderControl({
  mode,
  direction,
  onChange,
  modes = BOARD_SORT_MODES,
}: SortOrderControlProps) {
  const handleSelect = (nextMode: SortMode) => {
    if (nextMode === mode) {
      onChange(mode, direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    onChange(nextMode, DEFAULT_SORT_DIRECTION[nextMode]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Sort order"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        {modes.map((key) => {
          const isActive = mode === key;
          return (
            <DropdownMenuItem
              key={key}
              className={cn('justify-between gap-2', isActive && 'bg-accent')}
              onSelect={(e) => {
                e.preventDefault();
                handleSelect(key);
              }}
            >
              <span>{SORT_MODE_LABELS[key]}</span>
              {isActive &&
                (direction === 'asc' ? (
                  <ArrowUpAZ className="h-3.5 w-3.5 shrink-0 opacity-70" />
                ) : (
                  <ArrowDownAZ className="h-3.5 w-3.5 shrink-0 opacity-70" />
                ))}
            </DropdownMenuItem>
          );
        })}
        {mode === 'custom' && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Drag items to reorder
            </p>
          </>
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Click again to reverse
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
